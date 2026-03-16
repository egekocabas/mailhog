package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/smtp"
	"time"
)

type testEmailRequest struct {
	From    string `json:"from"`
	To      string `json:"to"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

func SendTestEmail(smtpAddr, from, to, subject, body string) error {
	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s", from, to, subject, body)
	if err := smtp.SendMail(smtpAddr, nil, from, []string{to}, []byte(msg)); err != nil {
		return fmt.Errorf("send mail: %w", err)
	}
	return nil
}

func VerifyEmailReceived(ctx context.Context, apiURL, subject string) (bool, error) {
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return false, ctx.Err()
		default:
		}

		found, err := checkMessages(apiURL, subject)
		if err == nil && found {
			return true, nil
		}
		time.Sleep(500 * time.Millisecond)
	}
	return false, nil
}

func checkMessages(apiURL, subject string) (bool, error) {
	resp, err := http.Get(apiURL + "/api/v2/messages")
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	var result struct {
		Items []struct {
			Content struct {
				Headers map[string][]string `json:"Headers"`
			} `json:"Content"`
		} `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, err
	}

	for _, item := range result.Items {
		if subjects, ok := item.Content.Headers["Subject"]; ok {
			for _, s := range subjects {
				if s == subject {
					return true, nil
				}
			}
		}
	}
	return false, nil
}

func isMailHogReady(ctx context.Context, apiURL string) bool {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL+"/api/v2/messages", nil)
	if err != nil {
		return false
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}
