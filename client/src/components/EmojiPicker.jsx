const EMOJIS = ['😀','😂','😍','😊','😎','🥳','😢','😡','👍','🙏','👏','🔥','❤️','🎉','🍕','☕','🚀','💯','😴','🤔','🙌','😅','🤝','✨'];

export default function EmojiPicker({ onPick, onClose }) {
  return (
    <>
      {/* click outside to close */}
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute bottom-12 left-0 z-20 w-64 bg-white border border-slate-100 rounded-xl shadow-lg p-2 grid grid-cols-8 gap-1">
        {EMOJIS.map((e) => (
          <button key={e} type="button" onClick={() => onPick(e)} className="text-xl hover:bg-slate-100 rounded">{e}</button>
        ))}
      </div>
    </>
  );
}
