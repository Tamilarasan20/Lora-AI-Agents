'use client';

interface PlatformPreviewProps {
  content: string;
  platform: 'instagram' | 'linkedin' | 'x' | 'tiktok';
  images?: string[];
  brandName?: string;
}

function InstagramPreview({ content, images, brandName }: { content: string; images: string[]; brandName: string }) {
  const lines = content.split('\n').filter(Boolean);
  const hookLine = lines[0] ?? '';
  const hashtagLine = lines.find(l => l.startsWith('#')) ?? '';
  const ctaLine = lines.find(l => l.startsWith('👉')) ?? '';
  const captionLines = lines.filter(l => l !== hookLine && !l.startsWith('#') && !l.startsWith('👉'));
  const captionText = captionLines.join(' ').trim();

  return (
    <div className="bg-white rounded-xl overflow-hidden text-black max-w-[340px] w-full shadow border border-gray-200">
      <div className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] shrink-0" />
        <span className="font-semibold text-[13px]">{brandName.toLowerCase().replace(/\s/g, '')}</span>
      </div>
      <div className="aspect-square bg-gray-100 flex items-center justify-center">
        {images.length > 0
          ? <img src={images[0]} alt="" className="w-full h-full object-cover" />
          : <div className="text-gray-300 text-4xl">📷</div>}
      </div>
      <div className="p-3">
        <div className="flex items-center gap-4 mb-2 text-[18px]">
          <span>❤️</span><span>💬</span><span>📤</span>
        </div>
        {hookLine && <p className="text-[13px] font-semibold leading-[1.4] mb-1"><span className="font-bold">{brandName.toLowerCase()} </span>{hookLine}</p>}
        {captionText && <p className="text-[13px] leading-[1.4] text-gray-700 mb-1.5">{captionText.length > 100 ? captionText.slice(0, 100) + '...more' : captionText}</p>}
        {ctaLine && <p className="text-[13px] font-bold text-blue-600 mb-1.5">{ctaLine}</p>}
        {hashtagLine && <p className="text-[12px] text-blue-500">{hashtagLine.slice(0, 80)}</p>}
      </div>
    </div>
  );
}

function LinkedInPreview({ content, images, brandName }: { content: string; images: string[]; brandName: string }) {
  const truncated = content.length > 280 ? content.slice(0, 277) + '...see more' : content;
  return (
    <div className="bg-white rounded-xl p-4 text-black max-w-[340px] w-full shadow border border-gray-200">
      <div className="flex gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#0A66C2] flex items-center justify-center text-white font-bold shrink-0">
          {brandName[0] ?? 'B'}
        </div>
        <div>
          <span className="font-semibold text-[14px] block">{brandName}</span>
          <span className="text-gray-500 text-[12px]">AI-Powered Growth · 1m</span>
        </div>
      </div>
      <p className="text-[14px] leading-[1.5] whitespace-pre-wrap break-words">{truncated}</p>
      {images.length > 0 && <div className="mt-3 rounded-lg overflow-hidden -mx-4"><img src={images[0]} alt="" className="w-full h-48 object-cover" /></div>}
      <div className="flex justify-between mt-3 pt-3 border-t border-gray-100 text-gray-500 text-[12px]">
        <span>👍 Like</span><span>💬 Comment</span><span>🔁 Repost</span><span>📤 Send</span>
      </div>
    </div>
  );
}

function TwitterPreview({ content, images, brandName }: { content: string; images: string[]; brandName: string }) {
  const truncated = content.length > 280 ? content.slice(0, 277) + '...' : content;
  return (
    <div className="bg-white rounded-2xl p-4 text-black max-w-[340px] w-full shadow border border-gray-100">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C1CD7D] to-[#8fa37a] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[14px]">{brandName}</span>
            <span className="text-gray-400 text-[13px]">· 1m</span>
          </div>
          <p className="text-[14px] leading-[1.4] mt-1 whitespace-pre-wrap break-words">{truncated}</p>
          {images.length > 0 && (
            <div className="mt-3 rounded-2xl overflow-hidden">
              <img src={images[0]} alt="" className="w-full h-32 object-cover" />
            </div>
          )}
          <div className="flex justify-between mt-3 text-gray-400 text-[12px]">
            <span>💬 0</span><span>🔁 0</span><span>❤️ 0</span><span>📊 0</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlatformPreview({ content, platform, images = [], brandName = 'Brand' }: PlatformPreviewProps) {
  const validImages = images.filter(img =>
    img && img.length > 5 && (img.startsWith('data:image/') || img.startsWith('http') || img.startsWith('/'))
  );

  const props = { content, images: validImages, brandName };

  switch (platform) {
    case 'instagram': return <InstagramPreview {...props} />;
    case 'linkedin':  return <LinkedInPreview {...props} />;
    case 'x':        return <TwitterPreview {...props} />;
    default:          return <InstagramPreview {...props} />;
  }
}
