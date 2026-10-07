import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { CreateRoomRequest, RoomDetail, RoomSummary } from "@ottv2/contracts";
import { routes } from "../../app/routes";
import { Button, LoadingState, Modal, UiGlyph, useToast } from "../ui";
import { createRoom, getRooms, joinRoom, subscribeToRooms } from "../../services/rooms/roomApi";
import { ApiError } from "../../services/http/apiError";
import { ensureGuestSession } from "../../services/guest/guestApi";
import { CreateRoomForm } from "./CreateRoomForm";
import { loginReturnPath } from "../../services/auth/returnUrl";

type RoomCardData = RoomSummary | RoomDetail;
type RoomBrowserVariant = "preview" | "full";
type RoomFilter = "ALL" | "MANUAL" | "BOT";
const timerLabels: Record<number, string> = { 30: "30 giây", 60: "1 phút", 300: "5 phút", 600: "10 phút", 1800: "30 phút", 3600: "60 phút" };
const filterLabels: Record<RoomFilter, string> = { ALL: "Tất cả", MANUAL: "Chơi trực tiếp", BOT: "Đấu chương trình" };

function modeLabel(playMode: RoomCardData["playMode"]) {
  return playMode === "BOT" ? "Đấu chương trình" : "Chơi trực tiếp";
}

function RoomCard({ room, onJoin, onCopy, onSpectate }: { room: RoomCardData; onJoin: (room: RoomCardData) => void; onCopy: (roomId: string) => void; onSpectate: (room: RoomCardData) => void }) {
  return <article className="room-card"><div className="room-card-head"><span className={`room-status ${room.status.toLowerCase()}`}>{room.status === "WAITING" ? "ĐANG CHỜ" : room.status}</span><span className="room-visibility">{room.visibility === "PRIVATE" ? <><UiGlyph name="lock" size={13} /> Riêng tư</> : "Công khai"}</span></div><h3>{room.name}</h3><div className="room-id-row"><p className="room-id">#{room.roomId}</p><button className="icon-button copy-room-button" type="button" aria-label={`Sao chép mã phòng ${room.roomId}`} onClick={() => onCopy(room.roomId)}><UiGlyph name="copy" size={16} /></button></div><div className="room-card-meta"><span><UiGlyph name="players" size={14} /> {room.players}/{room.playerCapacity}</span><span><UiGlyph name="clock" size={14} /> {timerLabels[room.timerSeconds] ?? `${room.timerSeconds} giây`}</span><span>{modeLabel(room.playMode)}</span></div><div className="room-card-tags" aria-label="Tính năng phòng">{room.refereeEnabled && <span className="room-tag">Trọng tài</span>}{room.spectatorsEnabled && <span className="room-tag">Khán giả</span>}</div><div className="room-card-actions"><Button className="room-join-button" variant="secondary" onClick={() => onJoin(room)} disabled={room.status !== "WAITING" || room.players >= room.playerCapacity}>{room.players >= room.playerCapacity ? "Đã đủ người" : "Tham gia"}</Button>{room.spectatorsEnabled && room.players > 0 && <Button className="room-spectate-button" variant="ghost" onClick={() => onSpectate(room)}>Xem trận</Button>}</div></article>;
}

export function RoomBrowser({ openCreateOnMount = false, variant = "preview" }: { openCreateOnMount?: boolean; variant?: RoomBrowserVariant }) {
  const navigate = useNavigate(); const location = useLocation(); const { notify } = useToast();
  const full = variant === "full";
  const [rooms, setRooms] = useState<RoomCardData[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [roomEvent, setRoomEvent] = useState(""); const previousRooms = useRef<RoomCardData[] | null>(null); const [query, setQuery] = useState(""); const [searchResult, setSearchResult] = useState<RoomCardData>(); const [createOpen, setCreateOpen] = useState(openCreateOnMount); const [joinTarget, setJoinTarget] = useState<RoomCardData>(); const [joinPassword, setJoinPassword] = useState(""); const [joinError, setJoinError] = useState(""); const [pending, setPending] = useState(false); const [roomFilter, setRoomFilter] = useState<RoomFilter>("ALL"); const [visibleLimit, setVisibleLimit] = useState(full ? 9 : 4);
  const [form, setForm] = useState<CreateRoomRequest>({ name: "", visibility: "PUBLIC", timerSeconds: 300, playMode: "MANUAL", spectatorsEnabled: false, spectatorCapacity: undefined, refereeEnabled: false, hostRole: "PLAYER" });

  const loadRooms = useCallback((showSpinner = true) => { if (showSpinner) setLoading(true); setError(""); getRooms(undefined, full ? 100 : 12).then((result) => { const nextRooms = result.rooms; const previous = previousRooms.current; if (previous !== null) { const previousById = new Map(previous.map((room) => [room.roomId, room])); const nextById = new Map(nextRooms.map((room) => [room.roomId, room])); const created = nextRooms.some((room) => !previousById.has(room.roomId)); const removed = previous.some((room) => !nextById.has(room.roomId)); const updated = nextRooms.some((room) => previousById.has(room.roomId) && JSON.stringify(previousById.get(room.roomId)) !== JSON.stringify(room)); setRoomEvent(created ? "Có phòng mới." : removed ? "Danh sách phòng đã cập nhật." : updated ? "Thông tin phòng đã cập nhật." : ""); } previousRooms.current = nextRooms; setRooms(nextRooms); }).catch((reason) => setError(reason instanceof ApiError ? reason.message : "Không thể tải danh sách phòng.")).finally(() => { if (showSpinner) setLoading(false); }); }, [full]);
  useEffect(() => {
    let fallback: number | undefined;
    const receive = (nextRooms: RoomSummary[]) => {
      const previous = previousRooms.current;
      if (previous !== null) {
        const previousById = new Map(previous.map((room) => [room.roomId, room]));
        const nextById = new Map(nextRooms.map((room) => [room.roomId, room]));
        const created = nextRooms.some((room) => !previousById.has(room.roomId));
        const removed = previous.some((room) => !nextById.has(room.roomId));
        const updated = nextRooms.some((room) => previousById.has(room.roomId) && JSON.stringify(previousById.get(room.roomId)) !== JSON.stringify(room));
        setRoomEvent(created ? "Có phòng mới." : removed ? "Danh sách phòng đã cập nhật." : updated ? "Thông tin phòng đã cập nhật." : "");
      }
      previousRooms.current = nextRooms; setRooms(nextRooms); setLoading(false); setError("");
    };
    loadRooms();
    let unsubscribe: () => void = () => undefined;
    try { unsubscribe = subscribeToRooms(receive, () => {
      setRoomEvent("Kết nối danh sách phòng bị gián đoạn; đang đồng bộ lại.");
      if (fallback === undefined) fallback = window.setInterval(() => loadRooms(false), 30000);
    }); } catch { setRoomEvent("Đang dùng đồng bộ dự phòng cho danh sách phòng."); }
    return () => { unsubscribe(); if (fallback !== undefined) window.clearInterval(fallback); };
  }, [loadRooms]);
  useEffect(() => { if (openCreateOnMount) setCreateOpen(true); }, [openCreateOnMount]);
  useEffect(() => { setVisibleLimit(full ? 9 : 4); }, [full, roomFilter]);

  const showAuthError = (reason: unknown) => { if (reason instanceof ApiError && reason.status === 401) { notify("Bạn cần đăng nhập để tạo hoặc tham gia phòng.", "warning"); navigate(loginReturnPath(location)); return; } notify(reason instanceof ApiError ? reason.message : "Thao tác phòng đấu thất bại.", "error"); };
  const copyRoomId = async (roomId: string) => { await navigator.clipboard?.writeText(roomId); notify(`Đã sao chép mã phòng ${roomId}.`, "success"); };
  const submitSearch = async (event: FormEvent) => { event.preventDefault(); if (!query.trim()) { setSearchResult(undefined); return; } setPending(true); try { const result = await getRooms(query); setSearchResult(result.rooms[0]); if (!result.rooms[0]) notify("Phòng đấu không tồn tại", "warning"); } catch (reason) { setSearchResult(undefined); notify(reason instanceof ApiError ? reason.message : "Phòng đấu không tồn tại", "warning"); } finally { setPending(false); } };
  const openSpectator = (room: RoomCardData) => { void ensureGuestSession().catch(() => undefined).then(() => navigate(`/spectate/${encodeURIComponent(room.roomId)}`)).catch(showAuthError); };
  const submitCreate = async (event: FormEvent) => { event.preventDefault(); if (form.visibility === "PUBLIC" && form.refereeEnabled && form.hostRole === "REFEREE") { notify("Chủ phòng làm trọng tài cần phòng Private.", "warning"); return; } setPending(true); try { await ensureGuestSession().catch(() => undefined); const result = await createRoom({ ...form, ...(form.visibility === "PUBLIC" ? { password: undefined } : {}) }, crypto.randomUUID()); setCreateOpen(false); notify(`Đã tạo phòng ${result.room.roomId}.`, "success"); const needsBotSelection = result.room.playMode === "BOT" && result.room.role === "PLAYER"; navigate(needsBotSelection ? `${routes.botOnline}?room=${encodeURIComponent(result.room.roomId)}` : `/game/${encodeURIComponent(result.room.roomId)}`); } catch (reason) { showAuthError(reason); } finally { setPending(false); } };
  const submitJoin = async (event: FormEvent) => { event.preventDefault(); if (!joinTarget) return; setPending(true); setJoinError(""); try { await ensureGuestSession().catch(() => undefined); const result = await joinRoom(joinTarget.roomId, joinTarget.visibility === "PRIVATE" ? { password: joinPassword } : {}, crypto.randomUUID()); setJoinTarget(undefined); setJoinPassword(""); notify("Đã vào phòng đấu.", "success"); navigate(result.room.playMode === "BOT" ? `${routes.botOnline}?room=${encodeURIComponent(result.room.roomId)}` : `/game/${encodeURIComponent(result.room.roomId)}`); } catch (reason) { if (reason instanceof ApiError && reason.status === 401 && joinTarget.visibility === "PRIVATE") setJoinError("Mật khẩu phòng không đúng."); else showAuthError(reason); } finally { setPending(false); } };
  const filteredRooms = roomFilter === "ALL" ? rooms : rooms.filter((room) => room.playMode === roomFilter);
  const shownRooms = full ? filteredRooms.slice(0, visibleLimit) : filteredRooms;

  return <section className={`rooms-section room-browser-${variant}`} id="rooms" data-room-browser-variant={variant}><div className="rooms-toolbar"><div><p className="eyebrow">ONLINE</p><h2>Danh sách Phòng Online</h2><p className="rooms-subtitle">Vào một phòng đang mở hoặc tạo không gian riêng cho trận Unranked.</p></div><div className="room-toolbar-actions"><form className="room-search" onSubmit={submitSearch}><label className="visually-hidden" htmlFor={`${variant}-room-search-input`}>Tìm Room ID</label><input id={`${variant}-room-search-input`} value={query} onChange={(event) => setQuery(event.target.value.toUpperCase())} placeholder="Nhập mã phòng" maxLength={6} /><Button type="submit" variant="secondary" pending={pending}>Tìm</Button></form><Button type="button" onClick={() => setCreateOpen(true)}>Tạo phòng</Button></div></div>{!full && <Link className="rooms-view-all" to={routes.rooms}>Xem tất cả <span aria-hidden="true">→</span></Link>}{full && <div className="room-filter-tabs" role="group" aria-label="Lọc loại phòng">{(Object.keys(filterLabels) as RoomFilter[]).map((filter) => <button key={filter} className={`room-filter-tab ${roomFilter === filter ? "active" : ""}`} type="button" aria-pressed={roomFilter === filter} onClick={() => setRoomFilter(filter)}>{filterLabels[filter]}</button>)}</div>}{roomEvent && <p className="rooms-live" role="status" aria-live="polite">{roomEvent}</p>}{searchResult && <div className="search-result"><span className="eyebrow">KẾT QUẢ TÌM KIẾM</span><RoomCard room={searchResult} onJoin={setJoinTarget} onCopy={copyRoomId} onSpectate={openSpectator} /></div>}{loading ? <LoadingState label="Đang tải phòng đấu…" /> : error ? <div className="rooms-empty"><strong>Không thể tải phòng</strong><p>{error}</p><Button variant="secondary" onClick={() => loadRooms()}>Thử lại</Button></div> : filteredRooms.length === 0 ? <div className="rooms-empty"><UiGlyph name="empty" size={26} /><strong>{rooms.length === 0 ? "Chưa có Phòng đấu nào" : "Không có phòng phù hợp"}</strong><p>{rooms.length === 0 ? "Bạn hãy tạo phòng đầu tiên." : "Thử bộ lọc khác hoặc tạo một phòng mới."}</p><Button type="button" onClick={() => setCreateOpen(true)}>{rooms.length === 0 ? "Tạo phòng đầu tiên" : "Tạo phòng"}</Button></div> : <><div className="room-grid-scroll"><div className="room-grid"><div className="room-grid-items">{shownRooms.map((room) => <RoomCard key={room.roomId} room={room} onJoin={setJoinTarget} onCopy={copyRoomId} onSpectate={openSpectator} />)}</div></div></div>{full && filteredRooms.length > shownRooms.length && <Button className="room-load-more" variant="secondary" type="button" onClick={() => setVisibleLimit((current) => current + 9)}>Xem thêm phòng</Button>}</>}
    <Modal open={createOpen} title="Tạo phòng đấu" description="Phòng custom luôn là Unranked. Chọn mode và vai trò trước khi mời người chơi." onClose={() => setCreateOpen(false)}><CreateRoomForm value={form} onChange={setForm} onSubmit={submitCreate} onCancel={() => setCreateOpen(false)} pending={pending} /></Modal>
    <Modal open={Boolean(joinTarget)} title="Tham gia phòng" description={joinTarget ? `${joinTarget.name} · #${joinTarget.roomId}` : undefined} onClose={() => { setJoinTarget(undefined); setJoinPassword(""); setJoinError(""); }}><form className="form-stack" onSubmit={submitJoin}>{joinTarget?.visibility === "PRIVATE" && <label>Mật khẩu phòng<input autoFocus value={joinPassword} onChange={(event) => { setJoinPassword(event.target.value); setJoinError(""); }} maxLength={12} required /></label>}{joinTarget?.visibility === "PUBLIC" && <p className="form-hint">Đây là phòng Public. Bạn có thể vào ngay nếu còn chỗ.</p>}{joinError && <p className="form-error" role="alert">{joinError}</p>}<div className="modal-actions"><Button type="button" variant="secondary" onClick={() => { setJoinTarget(undefined); setJoinError(""); }}>Huỷ</Button><Button type="submit" pending={pending}>Tham gia</Button></div></form></Modal>
  </section>;
}
