package main

import (
	"encoding/json"
	"flag"
	"net"
	"os"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/sirupsen/logrus"
)

var logger = logrus.New()

func main() {
	var socketPath string
	flag.StringVar(&socketPath, "socket", "/run/guest-services/backend.sock", "Unix domain socket to listen on")
	flag.Parse()

	_ = os.RemoveAll(socketPath)

	logger.SetOutput(os.Stdout)

	logMiddleware := middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogMethod:    true,
		LogURI:       true,
		LogStatus:    true,
		LogRequestID: true,
		LogLatency:   true,
		LogError:     true,
		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
			entry := map[string]any{
				"time":   v.StartTime.UTC().Format(time.RFC3339Nano),
				"id":     v.RequestID,
				"method": v.Method,
				"uri":    v.URI,
				"status": v.Status,
			}
			if v.Error != nil {
				entry["error"] = v.Error.Error()
			}
			b, _ := json.Marshal(entry)
			logger.Writer().Write(append(b, '\n'))
			return nil
		},
	})

	manager, err := NewManager()
	if err != nil {
		logger.Fatalf("create docker manager: %v", err)
	}
	h := NewHandler(manager)

	logger.Infof("Starting listening on %s\n", socketPath)
	router := echo.New()
	router.HideBanner = true
	router.Use(logMiddleware)

	ln, err := listen(socketPath)
	if err != nil {
		logger.Fatal(err)
	}
	router.Listener = ln

	router.GET("/mailhog/status", h.Status)
	router.POST("/mailhog/start", h.Start)
	router.POST("/mailhog/stop", h.Stop)
	router.POST("/mailhog/restart", h.Restart)
	router.POST("/mailhog/remove", h.Remove)
	router.POST("/mailhog/test", h.TestEmail)
	router.GET("/mailhog/messages", h.Messages)
	router.GET("/mailhog/settings", h.GetSettings)
	router.POST("/mailhog/settings", h.SaveSettings)

	logger.Fatal(router.Start(""))
}

func listen(path string) (net.Listener, error) {
	return net.Listen("unix", path)
}
