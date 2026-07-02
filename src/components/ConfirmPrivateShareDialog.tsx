interface Props {
  mediaLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmPrivateShareDialog({ mediaLabel, onCancel, onConfirm }: Props) {
  return (
    <div
      className="private-share-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="private-share-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="private-share-dialog">
        <h3 id="private-share-title">Prywatna treść — kopiować do schowka?</h3>
        <p>
          Plik {mediaLabel} trafi do schowka systemowego. Możesz go wkleić w WhatsApp, Telegramie
          lub innym komunikatorze. Upewnij się, że chcesz to udostępnić.
        </p>
        <div className="private-share-dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Anuluj
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>
            Kopiuj mimo to
          </button>
        </div>
      </div>
    </div>
  );
}
