import { Modal } from './Modal';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { InspectProps } from '../../../../interfaces/SharedInterfaces';

const InspectModal: React.FC<InspectProps> = ({ name, data, title, onClose }) => {
  const { dictionary } = useTranslation();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const highlightQuotedStrings = (text: string) => {
    const regex = /"([^"\\]|\\.)*":/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let key = 0;
    while ((match = regex.exec(text)) !== null) {
      const index = match.index;
      if (lastIndex < index) parts.push(text.slice(lastIndex, index));
      parts.push(
        <span key={key++} className="text-orange-600">
          {match[0]}
        </span>
      );
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={title || dictionary.app.common.details}
      description={name}
      icon={<span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />}
      size="lg"
      className="h-[min(80vh,650px)]"
    >
      <div
        ref={scrollRef}
        className="h-full font-mono text-sm whitespace-pre-wrap dark:text-gray-300"
      >
        {data ? <div>{highlightQuotedStrings(String(data))}</div> : dictionary.app.common.noData}
      </div>
    </Modal>
  );
};

export default InspectModal;
