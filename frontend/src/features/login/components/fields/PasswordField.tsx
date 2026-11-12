import TextField from './TextField';
import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { PasswordFieldProps } from '../../../../interfaces/AuthInterfaces';

const PasswordField: React.FC<PasswordFieldProps> = (props) => {
  const { dictionary } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <TextField
        label={props.label}
        type={show ? 'text' : 'password'}
        name={props.name}
        value={props.value}
        onChange={props.onChange}
        error={props.error}
        placeholder={props.placeholder}
      />
      <button
        type="button"
        className="absolute right-[10px] top-[32px] bg-transparent text-zinc-900 hover:scale-95 border-none cursor-pointer"
        onClick={() => setShow((s) => !s)}
        aria-label={dictionary.app.auth.togglePassword}
      >
        {show ? dictionary.app.common.hide : dictionary.app.common.show}
      </button>
    </div>
  );
};

export default PasswordField;
