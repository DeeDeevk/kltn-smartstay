export default function RoomGallery({ images = [], roomName = "" }) {
  const placeholders = [
    "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?q=80&w=2049",
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070",
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=2070",
    "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?q=80&w=2074",
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=2070"
  ];

  const mainImage = images[0]?.url || placeholders[0];
  const subImages = images.slice(1, 5).map(img => img.url);

  // Fill remaining slots if fewer than 5 images
  while (subImages.length < 4) {
    subImages.push(placeholders[subImages.length + 1]);
  }

  return (
    <div className="h-[450px] grid grid-cols-2 rounded-xl overflow-hidden gap-2">

      {/* Cột trái */}
      <div className="min-h-0 overflow-hidden rounded-l-xl w-full">
        <img
          src={mainImage}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
          alt={roomName}
        />
      </div>

      {/* Cột phải */}
      <div className="min-h-0 grid grid-cols-2 grid-rows-2 gap-2">
        {subImages.map((src, i) => (
          <div key={i} className={`min-h-0 overflow-hidden ${i === 1 ? 'rounded-tr-xl' : ''} ${i === 3 ? 'rounded-br-xl' : ''}`}>
            <img
              src={src}
              className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
              alt={`${roomName} ${i + 1}`}
            />
          </div>
        ))}
      </div>

    </div>
  );
}
