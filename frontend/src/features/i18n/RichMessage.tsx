import React from 'react';

interface RichMessageProps {
  template: string;
  values: Record<string, React.ReactNode>;
}

const placeholderPattern = /(\{\w+\})/;

const RichMessage: React.FC<RichMessageProps> = ({ template, values }) => (
  <>
    {template.split(placeholderPattern).map((part, partIndex) => {
      const placeholderName = /^\{(\w+)\}$/.exec(part)?.[1];
      const content = placeholderName && placeholderName in values ? values[placeholderName] : part;
      return <React.Fragment key={partIndex}>{content}</React.Fragment>;
    })}
  </>
);

export default RichMessage;
