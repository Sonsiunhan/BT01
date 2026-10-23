import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PasswordSchema } from "@ottv2/contracts";
import { Button, PasswordField } from "../components/ui";
import { AuthBrand } from "../components/auth/AuthBrand";
import { AuthLayout } from "../components/auth/AuthLayout";
import { routes } from "../app/routes";
import { recoveryApi, type RecoveryApi } from "../services/support/recoveryApi";

export interface AccountAccessPageProps {
  api?: RecoveryApi;
}

const genericResetError = "Mã khôi phục không hợp lệ hoặc đã hết hạn. Hãy yêu cầu hỗ trợ mới nếu cần.";

export default function AccountAccessPage({ api = recoveryApi }: AccountAccessPageProps) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  return token ? <ResetCredentialForm api={api} token={token} /> : <RecoveryRequestForm api={api} />;
}

function RecoveryRequestForm({ api }: { api: RecoveryApi }) {
  const [username, setUsername] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!username.trim() || !reason.trim()) {
      setError("Vui lòng nhập username và lý do cần hỗ trợ.");
      return;
    }
    setPending(true);
    try {
      await api.request({ username: username.trim(), reason: reason.trim() });
      setSubmitted(true);
    } catch {
      // The public endpoint deliberately uses a safe generic message. Never reveal
      // whether an account exists or which recovery state it has.
      setError("Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau.");
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-card" data-testid="account-access-request">
        <AuthBrand />
        <p className="eyebrow">ACCOUNT ACCESS / SUPPORT</p>
        <h1>Yêu cầu hỗ trợ tài khoản</h1>
        <p className="form-intro">
          Gửi yêu cầu nếu bạn không thể đăng nhập. Phản hồi này giống nhau cho mọi tài khoản để bảo vệ thông tin đăng nhập.
        </p>
        {submitted ? (
          <div className="recovery-success" role="status" aria-live="polite">
            <p className="form-success">Yêu cầu đã được tiếp nhận. Nếu cần, bộ phận hỗ trợ sẽ liên hệ qua kênh đã xác minh.</p>
            <Link className="button secondary" to={routes.login}>Quay lại đăng nhập</Link>
          </div>
        ) : (
          <form className="form-stack" onSubmit={submit} noValidate>
            <label htmlFor="support-username">
              Username
              <input
                id="support-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
                maxLength={128}
              />
            </label>
            <label htmlFor="support-reason">
              Lý do cần hỗ trợ
              <textarea
                id="support-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
                maxLength={2_000}
                required
              />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" pending={pending} pendingLabel="Đang gửi…">Gửi yêu cầu</Button>
          </form>
        )}
        <div className="form-links"><Link to={routes.login}>Quay lại đăng nhập</Link></div>
      </div>
    </AuthLayout>
  );
}

function ResetCredentialForm({ api, token }: { api: RecoveryApi; token: string }) {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const nextPasswordError = PasswordSchema.safeParse(newPassword).success ? undefined : "Mật khẩu phải có ít nhất 8 ký tự.";
    const nextConfirmError = newPassword === confirmPassword ? undefined : "Mật khẩu xác nhận không khớp.";
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    if (nextPasswordError || nextConfirmError) return;
    setPending(true);
    try {
      await api.reset({ token, newPassword });
      setDone(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      // Do not expose whether the token existed, was consumed, or belonged to an account.
      setError(genericResetError);
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-card" data-testid="account-access-reset">
        <AuthBrand />
        <p className="eyebrow">ACCOUNT ACCESS / RESET</p>
        <h1>Đặt lại mật khẩu</h1>
        <p className="form-intro">Mã khôi phục chỉ được dùng một lần. Không nhập mã này vào nơi khác.</p>
        {done ? (
          <div className="recovery-success" role="status" aria-live="polite">
            <p className="form-success">Mật khẩu đã được thay đổi an toàn. Bạn có thể đăng nhập lại.</p>
            <Button type="button" variant="secondary" onClick={() => navigate(routes.login)}>Đăng nhập</Button>
          </div>
        ) : (
          <form className="form-stack" onSubmit={submit} noValidate>
            <PasswordField
              id="support-new-password"
              label="Mật khẩu mới"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              error={passwordError}
            />
            <PasswordField
              id="support-confirm-password"
              label="Xác nhận mật khẩu mới"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              error={confirmError}
            />
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" pending={pending} pendingLabel="Đang cập nhật…">Đặt lại mật khẩu</Button>
          </form>
        )}
        <div className="form-links"><Link to={routes.login}>Quay lại đăng nhập</Link></div>
      </div>
    </AuthLayout>
  );
}
