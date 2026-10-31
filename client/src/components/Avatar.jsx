const COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500', 'bg-amber-500', 'bg-cyan-600'];

export default function Avatar({ name = '?', src, size = 'w-11 h-11', online, group }) {
  const color = COLORS[name.charCodeAt(0) % COLORS.length];
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className={`relative shrink-0 ${size}`}>
      {src ? (
        <img src={src} alt={name} className="w-full h-full rounded-full object-cover" />
      ) : (
        <div className={`w-full h-full rounded-full flex items-center justify-center text-white text-sm font-semibold ${group ? 'bg-blue-500' : color}`}>
          {initials}
        </div>
      )}
      {online && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 ring-2 ring-white" />}
    </div>
  );
}
