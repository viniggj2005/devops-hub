export interface LoginResponse {
  token: string;
  user: UserDTO;
}
export interface UserDTO {
  id: number;
  nome: string;
  email: string;
  language: string;
}
export interface AuthContextType {
  loading: boolean;
  token: string | null;
  user: UserDTO | null;
  error: string | null;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
}

export interface PasswordFieldProps {
  label: string;
  name?: string;
  value: string;
  placeholder?: string;
  error?: string | null;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}

export type TextFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
};

export type LoginButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { full?: boolean };
