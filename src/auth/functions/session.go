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
	mutex        sync.RWMutex
	sessions     map[string]*SessionStruct
	timeToLive   time.Duration
	windowOffers map[string]string
}

func NewManager(timeToLive time.Duration) *ManagerStruct {
	manager := &ManagerStruct{
		sessions:     make(map[string]*SessionStruct),
		timeToLive:   timeToLive,
		windowOffers: make(map[string]string),
	}
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
	now := time.Now()
	manager.mutex.Lock()
	session, ok := manager.sessions[token]
	if !ok {
		manager.mutex.Unlock()
		return nil, errors.New("token inválido")
	}
	if now.After(session.ExpiresAt) {
		delete(manager.sessions, token)
		manager.mutex.Unlock()
		return nil, errors.New("sessão expirada")
	}
	if manager.timeToLive > 0 {
		session.ExpiresAt = now.Add(manager.timeToLive)
	}
	manager.mutex.Unlock()
	return session, nil
}

func (manager *ManagerStruct) Destroy(token string) {
	manager.mutex.Lock()
	delete(manager.sessions, token)
	manager.mutex.Unlock()
}

func (manager *ManagerStruct) OfferToWindow(windowName string, token string) error {
	if _, err := manager.Validate(token); err != nil {
		return err
	}
	manager.mutex.Lock()
	manager.windowOffers[windowName] = token
	manager.mutex.Unlock()
	return nil
}

func (manager *ManagerStruct) ClaimForWindow(windowName string) (string, *SessionStruct, error) {
	manager.mutex.Lock()
	originToken, offered := manager.windowOffers[windowName]
	delete(manager.windowOffers, windowName)
	manager.mutex.Unlock()
	if !offered {
		return "", nil, errors.New("nenhuma sessão disponível para esta janela")
	}

	originSession, err := manager.Validate(originToken)
	if err != nil {
		return "", nil, err
	}
	return manager.Create(originSession.UserID)
}

func (manager *ManagerStruct) RevokeWindowOffer(windowName string) {
	manager.mutex.Lock()
	delete(manager.windowOffers, windowName)
	manager.mutex.Unlock()
}

func (manager *ManagerStruct) garbageCollector() {
	ticker := time.NewTicker(time.Minute)
	for range ticker.C {
		now := time.Now()
		manager.mutex.Lock()
		for token, session := range manager.sessions {
			if now.After(session.ExpiresAt) {
				delete(manager.sessions, token)
			}
		}
		manager.mutex.Unlock()
	}
}
