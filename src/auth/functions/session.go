package authFunctions

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"
)

type SessionStruct struct {
	Token     string
	UserID    uint
	ExpiresAt time.Time
}

type ManagerStruct struct {
	mutex      sync.RWMutex
	sessions   map[string]*SessionStruct
	timeToLive time.Duration
}

func NewManager(timeToLive time.Duration) *ManagerStruct {
	manager := &ManagerStruct{sessions: make(map[string]*SessionStruct), timeToLive: timeToLive}
	go manager.garbageCollector()
	return manager
}

func (manager *ManagerStruct) newToken() (string, error) {
	byteArray := make([]byte, 32)
	_, err := rand.Read(byteArray)
	return hex.EncodeToString(byteArray), err
}

func (manager *ManagerStruct) Create(userID uint) (string, *SessionStruct, error) {
	token, err := manager.newToken()
	if err != nil {
		return "", nil, err
	}
	session := &SessionStruct{Token: token, UserID: userID, ExpiresAt: time.Now().Add(manager.timeToLive)}
	manager.mutex.Lock()
	manager.sessions[token] = session
	manager.mutex.Unlock()
	return token, session, nil
}

func (manager *ManagerStruct) Validate(token string) (*SessionStruct, error) {
	manager.mutex.RLock()
	session, ok := manager.sessions[token]
	manager.mutex.RUnlock()
	if !ok {
		return nil, errors.New("token inválido")
	}
	if time.Now().After(session.ExpiresAt) {
		manager.Destroy(token)
		return nil, errors.New("sessão expirada")
	}
	return session, nil
}

func (manager *ManagerStruct) Destroy(token string) {
	manager.mutex.Lock()
	delete(manager.sessions, token)
	manager.mutex.Unlock()
}

func (manager *ManagerStruct) garbageCollector() {
	ticker := time.NewTicker(time.Minute)
	for range ticker.C {
		now := time.Now()
		manager.mutex.Lock()
		for key, value := range manager.sessions {
			if now.After(value.ExpiresAt) {
				delete(manager.sessions, key)
			}
		}
		manager.mutex.Unlock()
	}
}
