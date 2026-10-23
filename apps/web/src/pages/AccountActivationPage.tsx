import { useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { routes } from "../app/routes";
import { AuthBrand } from "../components/auth/AuthBrand";
import { AuthLayout } from "../components/auth/AuthLayout";
import { activationApi, type ActivationApi } from "../services/roster/activationApi";
import type { ClaimActivationResponse, SetupCredentialResponse } from "@ottv2/contracts";

export interface AccountActivationPageProps {
  apiClient?: ActivationApi;
  token?: string;
}

export function AccountActivationPage({
  apiClient = activationApi,
  token: propToken,
}: AccountActivationPageProps) {
  const { token: urlParamToken } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const queryToken = searchParams.get("token") ?? "";

  const initialToken = propToken ?? urlParamToken ?? queryToken ?? "";

  const [claimToken, setClaimToken] = useState(initialToken);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 1 = Enter info & Claim, Step 2 = Set password, Step 3 = Done
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [claimOutcome, setClaimOutcome] = useState<ClaimActivationResponse | null>(null);
  const [setupOutcome, setSetupOutcome] = useState<SetupCredentialResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Step 1: Claim Activation Identity
  const handleClaimSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedToken = claimToken.trim();
    const trimmedUsername = username.trim();
    const trimmedDisplayName = displayName.trim();

    if (!trimmedToken) {
      setError("Vui lòng nhập mã kích hoạt.");
      return;
    }
    if (!trimmedUsername || trimmedUsername.length < 3 || trimmedUsername.length > 32) {
      setError("Tên đăng nhập phải từ 3 đến 32 ký tự.");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      setError("Tên đăng nhập chỉ được chứa chữ cái, số, dấu gạch dưới và gạch ngang.");
      return;
    }
    if (!trimmedDisplayName || trimmedDisplayName.length < 2) {
      setError("Tên hiển thị phải có ít nhất 2 ký tự.");
      return;
    }

    setPending(true);
    try {
      const res = await apiClient.claim({
        claimToken: trimmedToken,
        username: trimmedUsername,
        displayName: trimmedDisplayName,
      });
      setClaimOutcome(res);
      setStep(2);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mã kích hoạt không hợp lệ hoặc đã hết hạn.");
    } finally {
      setPending(false);
    }
  };

  // Step 2: Setup Credential (Password)
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || password.length < 8) {
      setError("Mật khẩu phải có tối thiểu 8 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setPending(true);
    try {
      const res = await apiClient.setupCredential({
        claimToken: claimToken.trim(),
        password,
      });
      setSetupOutcome(res);
      setStep(3);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể thiết lập mật khẩu. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  };

  const copyRecoveryCode = () => {
    if (setupOutcome?.recoveryCode) {
      void navigator.clipboard?.writeText(setupOutcome.recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-card" data-testid="account-activation-card" style={{ maxWidth: 520, width: "100%" }}>
        <AuthBrand />
        <p className="eyebrow">P13 // ACCOUNT ACTIVATION</p>
        <h1 style={{ fontSize: "1.5rem", margin: "0.25rem 0 0.5rem" }}>
          {step === 3 ? "Kích hoạt hoàn tất!" : "Kích hoạt tài khoản thí sinh"}
        </h1>

        {step === 1 && (
          <>
            <p className="form-intro" style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              Nhập mã kích hoạt bạn đã nhận từ Ban tổ chức giải đấu và thiết lập tên tài khoản để bắt đầu.
            </p>

            <form onSubmit={handleClaimSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group">
                <label htmlFor="claim-token-input" style={{ display: "block", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Mã kích hoạt (Token) <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="claim-token-input"
                  data-testid="claim-token-input"
                  type="text"
                  value={claimToken}
                  onChange={(e) => setClaimToken(e.target.value)}
                  placeholder="Nhập mã kích hoạt…"
                  required
                  style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "0.4rem", border: "1px solid var(--border)", background: "var(--surface)" }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="activation-username" style={{ display: "block", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Tên đăng nhập mong muốn <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="activation-username"
                  data-testid="activation-username-input"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Từ 3–32 ký tự (chữ, số, _, -)"
                  required
                  style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "0.4rem", border: "1px solid var(--border)", background: "var(--surface)" }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="activation-display-name" style={{ display: "block", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Tên hiển thị <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="activation-display-name"
                  data-testid="activation-display-name-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Họ và tên của bạn"
                  required
                  style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "0.4rem", border: "1px solid var(--border)", background: "var(--surface)" }}
                />
              </div>

              {error && (
                <div role="alert" style={{ color: "#ef4444", fontSize: "0.9rem" }} data-testid="activation-error">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="button primary"
                disabled={pending}
                data-testid="claim-submit-btn"
                style={{ width: "100%", marginTop: "0.5rem" }}
              >
                {pending ? "Đang xác nhận…" : "Tiếp tục thiết lập mật khẩu →"}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid #10b981", borderRadius: "0.5rem", padding: "0.75rem", marginBottom: "1rem" }}>
              <p style={{ margin: 0, fontSize: "0.9rem" }}>
                Đã nhận diện: <strong>{claimOutcome?.displayName}</strong> (<code>{claimOutcome?.username}</code>)
              </p>
            </div>

            <p className="form-intro" style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              Thiết lập mật khẩu cá nhân cho tài khoản. Mật khẩu phải có tối thiểu 8 ký tự.
            </p>

            <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group">
                <label htmlFor="activation-password" style={{ display: "block", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Mật khẩu mới <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="activation-password"
                  data-testid="activation-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự…"
                  required
                  style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "0.4rem", border: "1px solid var(--border)", background: "var(--surface)" }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="activation-confirm-password" style={{ display: "block", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Xác nhận lại mật khẩu <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="activation-confirm-password"
                  data-testid="activation-confirm-password-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu…"
                  required
                  style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "0.4rem", border: "1px solid var(--border)", background: "var(--surface)" }}
                />
              </div>

              {error && (
                <div role="alert" style={{ color: "#ef4444", fontSize: "0.9rem" }} data-testid="activation-error">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="button primary"
                disabled={pending}
                data-testid="password-submit-btn"
                style={{ width: "100%", marginTop: "0.5rem" }}
              >
                {pending ? "Đang lưu mật khẩu…" : "Hoàn tất kích hoạt tài khoản"}
              </button>
            </form>
          </>
        )}

        {step === 3 && (
          <div data-testid="activation-success-panel" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ padding: "1rem", borderRadius: "0.5rem", background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981" }}>
              <p style={{ margin: 0, fontWeight: 600, color: "#10b981", fontSize: "1rem" }}>
                ✓ Tài khoản đã được kích hoạt thành công!
              </p>
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem" }}>
                Tên đăng nhập của bạn: <strong>{setupOutcome?.username}</strong>
              </p>
            </div>

            {setupOutcome?.recoveryCode && (
              <div
                style={{
                  padding: "1rem",
                  border: "1px solid #f59e0b",
                  borderRadius: "0.5rem",
                  background: "rgba(245, 158, 11, 0.1)",
                }}
              >
                <p style={{ margin: "0 0 0.5rem", fontWeight: 600, color: "#f59e0b", fontSize: "0.9rem" }}>
                  MÃ KHÔI PHỤC TÀI KHOẢN (DUY NHẤT 1 LẦN)
                </p>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <code
                    data-testid="recovery-code-value"
                    style={{
                      flex: 1,
                      padding: "0.5rem 0.75rem",
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.4rem",
                      fontWeight: "bold",
                      fontSize: "1.1rem",
                    }}
                  >
                    {setupOutcome.recoveryCode}
                  </code>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={copyRecoveryCode}
                    data-testid="copy-recovery-code-btn"
                    style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}
                  >
                    {copied ? "Đã sao chép!" : "Sao chép"}
                  </button>
                </div>
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
                  * Hãy ghi nhớ hoặc lưu mã này ở nơi an toàn. Mã này dùng để khôi phục tài khoản nếu bạn quên mật khẩu và sẽ không hiển thị lại.
                </p>
              </div>
            )}

            <Link
              to={routes.login}
              className="button primary"
              data-testid="activation-login-btn"
              style={{ textAlign: "center", textDecoration: "none", padding: "0.6rem 1rem" }}
            >
              Đăng nhập ngay
            </Link>
          </div>
        )}

        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <Link to={routes.login} style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            Đã có tài khoản? Đăng nhập tại đây
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

export default AccountActivationPage;
