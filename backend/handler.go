package main

import (
	"context"
	"io"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
)

type Handler struct {
	manager *Manager
}

func NewHandler(m *Manager) *Handler {
	return &Handler{manager: m}
}

func (h *Handler) Status(c echo.Context) error {
	status, err := h.manager.GetStatus(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, status)
}

func (h *Handler) Start(c echo.Context) error {
	var cfg Config
	if err := c.Bind(&cfg); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	// Check if already running
	status, err := h.manager.GetStatus(c.Request().Context())
	if err == nil && status.Running {
		return c.JSON(http.StatusConflict, map[string]string{"error": "mailhog is already running"})
	}

	if err := h.manager.StartMailHog(c.Request().Context(), cfg); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if err := h.waitForMailHog(c.Request().Context()); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "mailhog did not become ready: " + err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "started"})
}

func (h *Handler) Stop(c echo.Context) error {
	if err := h.manager.StopMailHog(c.Request().Context()); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if err := h.manager.RemoveMailHog(c.Request().Context()); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "stopped"})
}

func (h *Handler) Restart(c echo.Context) error {
	var cfg Config
	if err := c.Bind(&cfg); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	// Stop and remove (ignore errors — container may not exist)
	_ = h.manager.StopMailHog(c.Request().Context())
	_ = h.manager.RemoveMailHog(c.Request().Context())

	if err := h.manager.StartMailHog(c.Request().Context(), cfg); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if err := h.waitForMailHog(c.Request().Context()); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "mailhog did not become ready: " + err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "restarted"})
}

func (h *Handler) TestEmail(c echo.Context) error {
	var req testEmailRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	status, err := h.manager.GetStatus(c.Request().Context())
	if err != nil || !status.Running {
		return c.JSON(http.StatusConflict, map[string]string{"error": "mailhog is not running"})
	}

	smtpAddr := h.manager.GetMailHogSMTPAddr()
	apiURL := h.manager.GetMailHogAPIURL()

	if err := SendTestEmail(smtpAddr, req.From, req.To, req.Subject, req.Body); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	delivered, err := VerifyEmailReceived(c.Request().Context(), apiURL, req.Subject)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]bool{"delivered": delivered})
}

func (h *Handler) Messages(c echo.Context) error {
	apiURL := h.manager.GetMailHogAPIURL()
	resp, err := http.Get(apiURL + "/api/v2/messages")
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": err.Error()})
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSONBlob(resp.StatusCode, body)
}

func (h *Handler) waitForMailHog(ctx context.Context) error {
	apiURL := h.manager.GetMailHogAPIURL()
	deadline := time.Now().Add(30 * time.Second)
	for time.Now().Before(deadline) {
		if isMailHogReady(ctx, apiURL) {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(500 * time.Millisecond):
		}
	}
	return nil
}
