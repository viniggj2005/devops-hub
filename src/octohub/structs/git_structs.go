package octohubStructs

type Commit struct {
	Hash        string
	Author      string
	Email       string
	PseudoEmail string
	Date        string
	Title       string
}

type FileModification struct {
	File   string
	Status string
}

const (
	FileKindAdded      = "added"
	FileKindDeleted    = "deleted"
	FileKindRenamed    = "renamed"
	FileKindModified   = "modified"
	FileKindUntracked  = "untracked"
	FileKindConflicted = "conflicted"
)

type FilesStatus struct {
	FileName    string
	OldFileName string
	Status      string
	Kind        string
}

type Stash struct {
	ID      string
	Branch  string
	Message string
}

type BranchInfo struct {
	Ahead     int
	Behind    int
	IsCurrent bool
	IsRemote  bool
	Name      string
	Upstream  string
}

type WorkingFileDiff struct {
	Diff string
	Hash string
}

type CommitFileSelection struct {
	All         bool
	Lines       []int
	FileName    string
	OldFileName string
	Kind        string
	DiffHash    string
}

type CommitRequest struct {
	Summary     string
	Description string
	Files       []CommitFileSelection
}

const (
	MergeStrategyMerge  = "merge"
	MergeStrategyNoFF   = "no-ff"
	MergeStrategySquash = "squash"
	MergeStrategyRebase = "rebase"
)

type MergePreview struct {
	Ahead            int
	Behind           int
	UpToDate         bool
	CanFastForward   bool
	Commits          []Commit
	ConflictingFiles []string
}

type ReorderableCommit struct {
	Pushed    bool
	Hash      string
	Title     string
	Author    string
	ShortHash string
}

type ConflictFile struct {
	Markers    int
	Binary     bool
	Resolved   bool
	SameAsOurs bool
	File       string
	Kind       string
}

type ConflictReport struct {
	Files     []ConflictFile
	Operation OperationState
}

type OperationState struct {
	Step             int
	Total            int
	Kind             string
	Branch           string
	Message          string
	ConflictingFiles []string
}
