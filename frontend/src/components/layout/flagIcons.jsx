// SVG vẽ tay thay vì emoji cờ — emoji cờ quốc gia không render màu trên nhiều môi trường
// (thiếu font emoji, một số bản Windows/Linux cũ), SVG thì hiển thị nhất quán mọi nơi.
export function VNFlag(props) {
  return (
    <svg viewBox="0 0 60 60" {...props}>
      <rect width="60" height="60" fill="#DA251D" />
      <polygon
        fill="#FFCD00"
        points="30,13 34.9,27.4 49.9,27.4 37.8,35.9 42.4,50.3 30,41.4 17.6,50.3 22.2,35.9 10.1,27.4 25.1,27.4"
      />
    </svg>
  );
}

export function GBFlag(props) {
  return (
    <svg viewBox="0 0 60 60" {...props}>
      <rect width="60" height="60" fill="#00247D" />
      <g stroke="#FFFFFF" strokeWidth="11">
        <line x1="0" y1="0" x2="60" y2="60" />
        <line x1="60" y1="0" x2="0" y2="60" />
      </g>
      <g stroke="#CF142B" strokeWidth="4">
        <line x1="0" y1="0" x2="60" y2="60" />
        <line x1="60" y1="0" x2="0" y2="60" />
      </g>
      <g stroke="#FFFFFF" strokeWidth="20">
        <line x1="30" y1="0" x2="30" y2="60" />
        <line x1="0" y1="30" x2="60" y2="30" />
      </g>
      <g stroke="#CF142B" strokeWidth="11">
        <line x1="30" y1="0" x2="30" y2="60" />
        <line x1="0" y1="30" x2="60" y2="30" />
      </g>
    </svg>
  );
}
