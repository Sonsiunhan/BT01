import type { CreateRoomRequest } from "@ottv2/contracts";
import type { FormEvent } from "react";
import { Button } from "../ui";

const timerLabels: Record<number, string> = { 30: "30 giây", 60: "1 phút", 300: "5 phút", 600: "10 phút", 1800: "30 phút", 3600: "60 phút" };
const spectatorCapacities = [1, 2, 5, 10, 50, 100] as const;

export type CreateRoomFormProps = {
  value: CreateRoomRequest;
  pending?: boolean;
  onChange: (next: CreateRoomRequest) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

/** The creation contract is kept in one controlled, testable surface. */
export function CreateRoomForm({ value, pending = false, onChange, onSubmit, onCancel }: CreateRoomFormProps) {
  const refereeEnabled = Boolean(value.refereeEnabled);
  const hostRole = value.hostRole ?? "PLAYER";
  const invalidPublicRefereeHost = refereeEnabled && hostRole === "REFEREE" && value.visibility === "PUBLIC";
  const update = (patch: Partial<CreateRoomRequest>) => onChange({ ...value, ...patch });

  return <form className="form-stack create-room-form" onSubmit={onSubmit}>
    <label>Tên phòng <span className="field-hint">tuỳ chọn, tối đa 30 ký tự</span><input value={value.name ?? ""} onChange={(event) => update({ name: event.target.value })} maxLength={30} placeholder="Ví dụ: Đêm đấu xanh đỏ" /></label>
    <fieldset className="choice-fieldset"><legend>Kiểu thi đấu</legend>
      <label className="check-row"><input type="radio" name="room-play-mode" checked={(value.playMode ?? "MANUAL") === "MANUAL"} onChange={() => update({ playMode: "MANUAL" })} /> Chơi trực tiếp</label>
      <label className="check-row"><input type="radio" name="room-play-mode" checked={value.playMode === "BOT"} onChange={() => update({ playMode: "BOT" })} /> Đấu chương trình</label>
      <p className="form-hint">Luật OTT giữ nguyên; phòng Bot sẽ dùng preset giới hạn đã kiểm tra.</p>
    </fieldset>
    <fieldset className="choice-fieldset"><legend>Quyền truy cập</legend>
      <label className="check-row"><input type="radio" name="room-visibility" checked={value.visibility === "PUBLIC"} onChange={() => update({ visibility: "PUBLIC", password: undefined })} /> Public — xuất hiện trong danh sách</label>
      <label className="check-row"><input type="radio" name="room-visibility" checked={value.visibility === "PRIVATE"} onChange={() => update({ visibility: "PRIVATE" })} /> Private — cần mật khẩu</label>
    </fieldset>
    {value.visibility === "PRIVATE" && <label>Mật khẩu phòng<input value={value.password ?? ""} onChange={(event) => update({ password: event.target.value })} minLength={1} maxLength={12} required /></label>}
    <label>Thời gian mỗi bên<select value={value.timerSeconds} onChange={(event) => update({ timerSeconds: Number(event.target.value) as CreateRoomRequest["timerSeconds"] })}>{Object.entries(timerLabels).map(([seconds, label]) => <option value={seconds} key={seconds}>{label}</option>)}</select></label>
    <fieldset className="choice-fieldset"><legend>Vai trò phòng</legend>
      <label className="check-row"><input type="checkbox" checked={refereeEnabled} onChange={(event) => update({ refereeEnabled: event.target.checked, hostRole: event.target.checked ? hostRole : "PLAYER" })} /> Có Trọng tài</label>
      {refereeEnabled && <div className="nested-choice-fieldset">
        <span className="field-hint">Chủ phòng chọn vai trò của mình</span>
        <label className="check-row"><input type="radio" name="room-host-role" checked={hostRole === "PLAYER"} onChange={() => update({ hostRole: "PLAYER" })} /> Tôi làm Người chơi</label>
        <label className="check-row"><input type="radio" name="room-host-role" checked={hostRole === "REFEREE"} onChange={() => update({ hostRole: "REFEREE" })} /> Tôi làm Trọng tài</label>
        {invalidPublicRefereeHost && <p className="form-error" role="alert">Chủ phòng làm trọng tài cần phòng Private để mời người chơi.</p>}
      </div>}
    </fieldset>
    <fieldset className="choice-fieldset"><legend>Khán giả</legend>
      <label className="check-row"><input type="checkbox" checked={Boolean(value.spectatorsEnabled)} onChange={(event) => update({ spectatorsEnabled: event.target.checked, spectatorCapacity: event.target.checked ? (value.spectatorCapacity ?? 10) : undefined })} /> Cho phép spectator</label>
      {value.spectatorsEnabled && <label>Sức chứa khán giả<select value={value.spectatorCapacity ?? 10} onChange={(event) => update({ spectatorCapacity: Number(event.target.value) as CreateRoomRequest["spectatorCapacity"] })}>{spectatorCapacities.map((capacity) => <option value={capacity} key={capacity}>{capacity} người</option>)}</select></label>}
    </fieldset>
    <div className="modal-actions"><Button type="button" variant="secondary" onClick={onCancel}>Huỷ</Button><Button type="submit" disabled={invalidPublicRefereeHost} pending={pending} pendingLabel="Đang tạo…">Tạo phòng</Button></div>
  </form>;
}
