package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	dockerimage "github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
)

const (
	mailHogImage     = "mailhog/mailhog"
	networkName      = "mailhog-extension-network"
	smtpInternalPort = 1025
	uiInternalPort   = 8025
	extensionLabel   = "com.egekocabas.mailhog-extension"
)

type Config struct {
	SMTPHostPort int `json:"smtpHostPort"`
	UIHostPort   int `json:"uiHostPort"`
}

type Status struct {
	Running       bool   `json:"running"`
	ContainerID   string `json:"containerID,omitempty"`
	ContainerName string `json:"containerName,omitempty"`
	SMTPHostPort  string `json:"smtpHostPort,omitempty"`
	UIHostPort    string `json:"uiHostPort,omitempty"`
}

type Manager struct {
	cli           *client.Client
	mu            sync.Mutex
	containerName string
	containerIP   string
}

func NewManager() (*Manager, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("create docker client: %w", err)
	}
	return &Manager{cli: cli}, nil
}

func (m *Manager) ensureNetwork(ctx context.Context) (string, error) {
	networks, err := m.cli.NetworkList(ctx, network.ListOptions{
		Filters: filters.NewArgs(filters.Arg("name", networkName)),
	})
	if err != nil {
		return "", fmt.Errorf("list networks: %w", err)
	}
	for _, n := range networks {
		if n.Name == networkName {
			return n.ID, nil
		}
	}
	resp, err := m.cli.NetworkCreate(ctx, networkName, network.CreateOptions{
		Driver: "bridge",
	})
	if err != nil {
		return "", fmt.Errorf("create network: %w", err)
	}
	return resp.ID, nil
}

func (m *Manager) connectBackendToNetwork(ctx context.Context, networkID string) error {
	hostname, err := os.Hostname()
	if err != nil {
		return fmt.Errorf("get hostname: %w", err)
	}
	// Check if already connected
	nw, err := m.cli.NetworkInspect(ctx, networkID, network.InspectOptions{})
	if err != nil {
		return fmt.Errorf("inspect network: %w", err)
	}
	for id := range nw.Containers {
		if len(id) >= len(hostname) && id[:len(hostname)] == hostname {
			return nil
		}
	}
	err = m.cli.NetworkConnect(ctx, networkID, hostname, &network.EndpointSettings{})
	if err != nil {
		logger.Warnf("connect backend to network: %v", err)
	}
	return nil
}

func (m *Manager) pullImage(ctx context.Context) error {
	reader, err := m.cli.ImagePull(ctx, mailHogImage, dockerimage.PullOptions{})
	if err != nil {
		return fmt.Errorf("pull image: %w", err)
	}
	defer reader.Close()
	_, err = io.Copy(io.Discard, reader)
	return err
}

func (m *Manager) checkPortConflicts(ctx context.Context, cfg Config) error {
	if cfg.SMTPHostPort == 0 && cfg.UIHostPort == 0 {
		return nil
	}
	running, err := m.cli.ContainerList(ctx, container.ListOptions{All: false})
	if err != nil {
		return fmt.Errorf("list containers: %w", err)
	}
	for _, c := range running {
		name := ""
		if len(c.Names) > 0 {
			name = strings.TrimPrefix(c.Names[0], "/")
		}
		for _, p := range c.Ports {
			if p.PublicPort == 0 {
				continue
			}
			hostPort := int(p.PublicPort)
			if cfg.SMTPHostPort > 0 && hostPort == cfg.SMTPHostPort {
				return fmt.Errorf("port %d is already in use by container %q", cfg.SMTPHostPort, name)
			}
			if cfg.UIHostPort > 0 && hostPort == cfg.UIHostPort {
				return fmt.Errorf("port %d is already in use by container %q", cfg.UIHostPort, name)
			}
		}
	}
	return nil
}

func (m *Manager) StartMailHog(ctx context.Context, cfg Config) error {
	if err := m.checkPortConflicts(ctx, cfg); err != nil {
		return err
	}

	networkID, err := m.ensureNetwork(ctx)
	if err != nil {
		return err
	}

	if err := m.connectBackendToNetwork(ctx, networkID); err != nil {
		logger.Warnf("connect backend to network: %v", err)
	}

	// Reuse existing stopped container if one exists with our label
	existingName, _ := m.resolveContainerName(ctx)
	if existingName != "" {
		if err := m.cli.ContainerStart(ctx, existingName, container.StartOptions{}); err != nil {
			_ = m.cli.ContainerRemove(ctx, existingName, container.RemoveOptions{Force: true})
			m.mu.Lock()
			m.containerName = ""
			m.mu.Unlock()
			return fmt.Errorf("start existing container: %w", err)
		}
		return nil
	}

	if err := m.pullImage(ctx); err != nil {
		return err
	}

	portBindings := nat.PortMap{}
	exposedPorts := nat.PortSet{}

	smtpPort := nat.Port(fmt.Sprintf("%d/tcp", smtpInternalPort))
	uiPort := nat.Port(fmt.Sprintf("%d/tcp", uiInternalPort))
	exposedPorts[smtpPort] = struct{}{}
	exposedPorts[uiPort] = struct{}{}

	if cfg.SMTPHostPort > 0 {
		portBindings[smtpPort] = []nat.PortBinding{
			{HostIP: "0.0.0.0", HostPort: fmt.Sprintf("%d", cfg.SMTPHostPort)},
		}
	}
	if cfg.UIHostPort > 0 {
		portBindings[uiPort] = []nat.PortBinding{
			{HostIP: "0.0.0.0", HostPort: fmt.Sprintf("%d", cfg.UIHostPort)},
		}
	}

	resp, err := m.cli.ContainerCreate(ctx,
		&container.Config{
			Image:        mailHogImage,
			ExposedPorts: exposedPorts,
			Labels:       map[string]string{extensionLabel: "true"},
		},
		&container.HostConfig{
			PortBindings: portBindings,
		},
		&network.NetworkingConfig{
			EndpointsConfig: map[string]*network.EndpointSettings{
				networkName: {NetworkID: networkID},
			},
		},
		nil,
		"",
	)
	if err != nil {
		return fmt.Errorf("create container: %w", err)
	}

	if err := m.cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		_ = m.cli.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		return fmt.Errorf("start container: %w", err)
	}

	m.cacheContainerInfo(ctx, resp.ID)
	return nil
}

// cacheContainerInfo inspects a container and stores its name and network IP.
func (m *Manager) cacheContainerInfo(ctx context.Context, containerID string) {
	info, err := m.cli.ContainerInspect(ctx, containerID)
	if err != nil {
		return
	}
	m.mu.Lock()
	m.containerName = strings.TrimPrefix(info.Name, "/")
	if net, ok := info.NetworkSettings.Networks[networkName]; ok {
		m.containerIP = net.IPAddress
	}
	m.mu.Unlock()
}

func (m *Manager) findContainerByLabel(ctx context.Context) (string, error) {
	containers, err := m.cli.ContainerList(ctx, container.ListOptions{
		All:     true,
		Filters: filters.NewArgs(filters.Arg("label", extensionLabel)),
	})
	if err != nil || len(containers) == 0 {
		return "", err
	}
	return strings.TrimPrefix(containers[0].Names[0], "/"), nil
}

func (m *Manager) resolveContainerName(ctx context.Context) (string, error) {
	m.mu.Lock()
	name := m.containerName
	m.mu.Unlock()
	if name != "" {
		return name, nil
	}
	name, err := m.findContainerByLabel(ctx)
	if err != nil {
		return "", err
	}
	if name != "" {
		m.cacheContainerInfo(ctx, name)
	}
	return name, nil
}

func (m *Manager) StopMailHog(ctx context.Context) error {
	name, err := m.resolveContainerName(ctx)
	if err != nil {
		return err
	}
	if name == "" {
		return nil
	}
	timeout := 10
	if err := m.cli.ContainerStop(ctx, name, container.StopOptions{Timeout: &timeout}); err != nil {
		if client.IsErrNotFound(err) {
			return nil
		}
		return fmt.Errorf("stop container: %w", err)
	}
	return nil
}

func (m *Manager) RemoveMailHog(ctx context.Context) error {
	name, err := m.resolveContainerName(ctx)
	if err != nil {
		return err
	}
	if name == "" {
		return nil
	}
	if err := m.cli.ContainerRemove(ctx, name, container.RemoveOptions{Force: true}); err != nil {
		if client.IsErrNotFound(err) {
			return nil
		}
		return fmt.Errorf("remove container: %w", err)
	}
	m.mu.Lock()
	m.containerName = ""
	m.containerIP = ""
	m.mu.Unlock()
	return nil
}

func (m *Manager) GetStatus(ctx context.Context) (Status, error) {
	name, err := m.resolveContainerName(ctx)
	if err != nil {
		return Status{}, err
	}
	if name == "" {
		return Status{Running: false}, nil
	}

	info, err := m.cli.ContainerInspect(ctx, name)
	if err != nil {
		if client.IsErrNotFound(err) {
			m.mu.Lock()
			m.containerName = ""
			m.mu.Unlock()
			return Status{Running: false}, nil
		}
		return Status{}, fmt.Errorf("inspect container: %w", err)
	}

	status := Status{
		Running:       info.State.Running,
		ContainerID:   info.ID[:12],
		ContainerName: strings.TrimPrefix(info.Name, "/"),
	}

	smtpPort := nat.Port(fmt.Sprintf("%d/tcp", smtpInternalPort))
	uiPort := nat.Port(fmt.Sprintf("%d/tcp", uiInternalPort))

	if bindings, ok := info.NetworkSettings.Ports[smtpPort]; ok && len(bindings) > 0 {
		status.SMTPHostPort = bindings[0].HostPort
	}
	if bindings, ok := info.NetworkSettings.Ports[uiPort]; ok && len(bindings) > 0 {
		status.UIHostPort = bindings[0].HostPort
	}

	return status, nil
}

func (m *Manager) GetMailHogSMTPAddr() string {
	m.mu.Lock()
	host := m.containerIP
	if host == "" {
		host = m.containerName
	}
	m.mu.Unlock()
	return fmt.Sprintf("%s:%d", host, smtpInternalPort)
}

func (m *Manager) GetMailHogAPIURL() string {
	m.mu.Lock()
	host := m.containerIP
	if host == "" {
		host = m.containerName
	}
	m.mu.Unlock()
	return fmt.Sprintf("http://%s:%d", host, uiInternalPort)
}
