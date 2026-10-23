package types

import (
	"bytes"
	"context"
	"encoding/hex"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func validHexKey() string {
	keyBytes := bytes.Repeat([]byte{0x42}, 32)
	return hex.EncodeToString(keyBytes)
}

func TestSetSessionKey(test *testing.T) {
	err := SetSessionKey("invalid-hex")
	if err == nil {
		test.Fatalf("expected error for invalid hex key, got nil")
	}

	hexKey := validHexKey()
	err = SetSessionKey(hexKey)
	if err != nil {
		test.Fatalf("unexpected error setting session key: %v", err)
	}

	if len(currentKey()) != 32 {
		test.Fatalf("expected 32-byte session key, got %d", len(currentKey()))
	}
}

func TestEncryptAndDecrypt(test *testing.T) {
	key := bytes.Repeat([]byte{0x11}, 32)
	message := []byte("secret-devops-hub-payload")

	encrypted, err := encrypt(message, key)
	if err != nil {
		test.Fatalf("unexpected error encrypting: %v", err)
	}

	decrypted, err := decrypt(encrypted, key)
	if err != nil {
		test.Fatalf("unexpected error decrypting: %v", err)
	}

	if !bytes.Equal(decrypted, message) {
		test.Fatalf("expected %q, got %q", string(message), string(decrypted))
	}

	_, err = encrypt(message, []byte("short"))
	if err == nil {
		test.Fatalf("expected error encrypting with invalid key size")
	}

	_, err = decrypt(encrypted, []byte("short"))
	if err == nil {
		test.Fatalf("expected error decrypting with invalid key size")
	}

	_, err = decrypt([]byte("short"), key)
	if err == nil {
		test.Fatalf("expected error decrypting malformed ciphertext")
	}

	wrongKey := bytes.Repeat([]byte{0x22}, 32)
	_, err = decrypt(encrypted, wrongKey)
	if err == nil {
		test.Fatalf("expected error decrypting with wrong key")
	}
}

type sampleEncryptedRecord struct {
	ID     uint `gorm:"primaryKey"`
	Secret EncryptedString
}

func TestEncryptedStringMethodsAndGorm(test *testing.T) {
	err := SetSessionKey(validHexKey())
	if err != nil {
		test.Fatalf("unexpected error setting session key: %v", err)
	}

	encryptedField := EncryptedString{Plaintext: "my-super-secret"}
	if encryptedField.GormDataType() != "blob" {
		test.Fatalf("expected blob, got %s", encryptedField.GormDataType())
	}
	if encryptedField.GormDBDataType(nil, nil) != "BLOB" {
		test.Fatalf("expected BLOB, got %s", encryptedField.GormDBDataType(nil, nil))
	}

	driverValue, err := encryptedField.Value()
	if err != nil {
		test.Fatalf("unexpected error getting driver value: %v", err)
	}

	var scannedField EncryptedString
	err = scannedField.Scan(driverValue)
	if err != nil {
		test.Fatalf("unexpected error scanning value: %v", err)
	}
	if scannedField.Plaintext != "my-super-secret" {
		test.Fatalf("expected my-super-secret, got %s", scannedField.Plaintext)
	}

	err = scannedField.Scan("not-a-byte-slice")
	if err == nil {
		test.Fatalf("expected error scanning invalid type")
	}

	err = scannedField.Scan([]byte("malformed"))
	if err == nil {
		test.Fatalf("expected error scanning malformed ciphertext")
	}

	clauseExpression := encryptedField.GormValue(context.Background(), nil)
	if clauseExpression.SQL != "?" || len(clauseExpression.Vars) != 1 {
		test.Fatalf("unexpected gorm value expression: %+v", clauseExpression)
	}

	dataBase, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		test.Fatalf("unexpected error opening sqlite: %v", err)
	}
	err = dataBase.AutoMigrate(&sampleEncryptedRecord{})
	if err != nil {
		test.Fatalf("unexpected error migrating: %v", err)
	}

	record := sampleEncryptedRecord{Secret: EncryptedString{Plaintext: "stored-in-sqlite"}}
	err = dataBase.Create(&record).Error
	if err != nil {
		test.Fatalf("unexpected error creating record: %v", err)
	}

	var loaded sampleEncryptedRecord
	err = dataBase.First(&loaded, record.ID).Error
	if err != nil {
		test.Fatalf("unexpected error loading record: %v", err)
	}
	if loaded.Secret.Plaintext != "stored-in-sqlite" {
		test.Fatalf("expected stored-in-sqlite, got %s", loaded.Secret.Plaintext)
	}
}

