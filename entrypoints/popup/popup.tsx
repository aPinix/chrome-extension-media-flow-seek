import { PopupContent } from '@/components/popup/popup-content';
import { ThemeProvider } from '@/components/theme-provider';

function Popup() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="theme-mode">
      <PopupContent />
    </ThemeProvider>
  );
}

export default Popup;
