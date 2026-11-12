import { CornerUpLeft } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';

const GoBackButton: React.FC<{ onGoBack?: () => void }> = ({ onGoBack }) => {
  const { dictionary } = useTranslation();
  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else if (onGoBack) {
      onGoBack();
    }
  };
  return (
    <>
      <button
        onClick={goBack}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-white/10 px-3 py-2 text-sm hover:scale-[0.98]"
        aria-label={dictionary.app.common.back}
      >
        <CornerUpLeft className="h-5 w-5" />
        <span className="hidden sm:inline">{dictionary.app.common.back}</span>
      </button>
    </>
  );
};

export default GoBackButton;
