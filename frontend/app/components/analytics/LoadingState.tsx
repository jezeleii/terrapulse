export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="text-[10px] text-[#7ef6e0]/60 tracking-[0.2em] animate-pulse">
          LOADING DATA FEED...
        </div>
        <div className="mt-3 h-px w-48 bg-[#0c0c0c] overflow-hidden mx-auto">
          <div className="h-full bg-[#7ef6e0]/40 animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  );
}
