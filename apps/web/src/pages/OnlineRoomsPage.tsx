import { RoomBrowser } from "../components/rooms/RoomBrowser";

export default function OnlineRoomsPage() {
  return (
    <section className="rooms-full-page rooms-visual-shell" aria-labelledby="rooms-page-title">
      <header className="rooms-full-page-header">
        <div>
          <p className="eyebrow">ĐẤU TRƯỜNG ONLINE</p>
          <h1 id="rooms-page-title">Danh sách Phòng</h1>
          <p className="rooms-subtitle">Tạo hoặc tham gia phòng đấu Unranked — mọi phong cách, mọi lúc.</p>
        </div>
      </header>
      <RoomBrowser variant="full" />
    </section>
  );
}
