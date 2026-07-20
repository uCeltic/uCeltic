import { Link } from "react-router-dom";
import AccountShell, { link } from "./AccountShell";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <AccountShell title="Sign in">
      <LoginForm />

      <p className="mt-4 text-sm text-[#6B6B67]">
        <Link to="/account/password/reset" className={link}>
          Forgot your password?
        </Link>
      </p>
      <p className="mt-1 text-sm text-[#6B6B67]">
        No account yet?{" "}
        <Link to="/account/signup" className={link}>
          Register
        </Link>
      </p>
    </AccountShell>
  );
}
