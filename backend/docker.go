package main

import (
	"context"
	"fmt"
	"io"
	"os"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	dockerimage "github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
)

const (
	mailHogImage     = "mailhog/mailhog"
	containerName    = "mailhog-extension"
	networkName      = "mailhog-extension-network"
	smtpInternalPort = 1025
	uiInternalPort   = 8025
)

type Config struct {
	SMTPHostPort int `json:"smtpHostPort"`
	UIHostPort   int `json:"uiHostPort"`
}

type Status struct {
	Running      bool   `json:"running"`
	ContainerID  string `json:"containerID,omitempty"`
	SMTPHostPort string `json:"smtpHostPort,omitempty"`
	UIHostPort   string `json:"uiHostPort,omitempty"`
}

type Manager struct {
	cli *client.Client
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

func (m *Manager) StartMailHog(ctx context.Context, cfg Config) error {
	networkID, err := m.ensureNetwork(ctx)
	if err != nil {
		return err
	}

	if err := m.connectBackendToNetwork(ctx, networkID); err != nil {
		logger.Warnf("connect backend to network: %v", err)
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
		containerName,
	)
	if err != nil {
		return fmt.Errorf("create container: %w", err)
	}

	if err := m.cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return fmt.Errorf("start container: %w", err)
	}
	return nil
}

func (m *Manager) StopMailHog(ctx context.Context) error {
	timeout := 10
	if err := m.cli.ContainerStop(ctx, containerName, container.StopOptions{Timeout: &timeout}); err != nil {
		if client.IsErrNotFound(err) {
			return nil
		}
		return fmt.Errorf("stop container: %w", err)
	}
	return nil
}

func (m *Manager) RemoveMailHog(ctx context.Context) error {
	if err := m.cli.ContainerRemove(ctx, containerName, container.RemoveOptions{Force: true}); err != nil {
		if client.IsErrNotFound(err) {
			return nil
		}
		return fmt.Errorf("remove container: %w", err)
	}
	return nil
}

func (m *Manager) GetStatus(ctx context.Context) (Status, error) {
	info, err := m.cli.ContainerInspect(ctx, containerName)
	if err != nil {
		if client.IsErrNotFound(err) {
			return Status{Running: false}, nil
		}
		return Status{}, fmt.Errorf("inspect container: %w", err)
	}

	status := Status{
		Running:     info.State.Running,
		ContainerID: info.ID[:12],
	}

	smtpPort := nat.Port(fmt.Sprintf("%d/tcp", smtpInternalPort))
	uiPort := nat.Port(fmt.Sprintf("%d/tcp", uiInternalPort))

	if bindings, ok := info.HostConfig.PortBindings[smtpPort]; ok && len(bindings) > 0 {
		status.SMTPHostPort = bindings[0].HostPort
	}
	if bindings, ok := info.HostConfig.PortBindings[uiPort]; ok && len(bindings) > 0 {
		status.UIHostPort = bindings[0].HostPort
	}

	return status, nil
}

func (m *Manager) GetMailHogSMTPAddr() string {
	return fmt.Sprintf("%s:%d", containerName, smtpInternalPort)
}

func (m *Manager) GetMailHogAPIURL() string {
	return fmt.Sprintf("http://%s:%d", containerName, uiInternalPort)
}
