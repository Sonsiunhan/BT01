import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui";
import { routes } from "../app/routes";
import { getGuestProfile, setGuestProfile } from "../services/local/localGameStorage";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthBrand } from "../components/auth/AuthBrand";

export default function GuestSetupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true); setError("");
    void getGuestProfile().then((profile) => { if (live && profile) setName(profile.displayName); })
      .catch(() => { if (live) setError("Không thể đọc danh tính khách. Hãy kiểm tra quyền lưu trữ trình duyệt rồi thử lại."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [attempt]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (loading || pending) return;
    const displayName = name.trim();
    if (displayName.length < 2 || displayName.length > 20) { setError("Tên khách phải dài 2–20 ký tự."); return; }
    setPending(true); setError("");
    try {
      await setGuestProfile({ displayName });
      navigate(routes.offline, { replace: true });
    } catch { setError("Không thể lưu danh tính khách. Hãy kiểm tra quyền lưu trữ rồi thử lại."); }
    finally { setPending(false); }
  }

  return <AuthLayout><div className="auth-card guest-onboarding"><AuthBrand />
    <p className="eyebrow">DANH TÍNH KHÁCH</p><h1>Chơi nhanh với tư cách khách</h1>
    <p className="form-intro">Bạn có thể chơi Online thường, Đấu máy hoặc Offline mà không cần tài khoản. Xếp hạng cần đăng nhập.</p>
    <div className="guest-warning" role="status"><strong>Tên khách giữ trên trình duyệt này</strong><span>Lịch sử local có thể bị mất nếu xóa dữ liệu trình duyệt. Bạn có thể chọn nhập lịch sử vào tài khoản sau khi đăng nhập.</span></div>
    <form className="form-stack" onSubmit={(event) => void submit(event)}>
      <label>Tên khách<input value={name} readOnly aria-describedby="guest-name-help" /></label>
      <small id="guest-name-help">{loading ? "Đang đọc danh tính khách…" : "Tên tự động, không phải tài khoản đăng nhập."}</small>
      {error && <><p className="form-error" role="alert">{error}</p><Button type="button" variant="secondary" onClick={() => setAttempt((value) => value + 1)}>Thử lại</Button></>}
      <div className="modal-actions"><Link className="button secondary" to={routes.home}>Về sảnh</Link><Button type="submit" disabled={loading || !name} pending={pending} pendingLabel="Đang lưu…">Tiếp tục</Button></div>
    </form>
  </div></AuthLayout>;
}
