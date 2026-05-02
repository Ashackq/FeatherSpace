import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { runtimeConfig } from "../config/runtime";

type InviteLookupState =
  | { status: "loading" }
  | { status: "error"; message: string };

export function InviteJoinPage() {
  const { inviteToken } = useParams();
  const navigate = useNavigate();
  const [lookupState, setLookupState] = useState<InviteLookupState>({ status: "loading" });

  useEffect(() => {
    if (!inviteToken) {
      setLookupState({ status: "error", message: "Invalid invite link." });
      return;
    }

    if (!runtimeConfig.apiUrl) {
      setLookupState({ status: "error", message: "Invite service is unavailable." });
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch(`${runtimeConfig.apiUrl}/invites/${inviteToken}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          setLookupState({ status: "error", message: "Invite not found or expired." });
          return;
        }

        const data = (await response.json()) as { roomId?: string };
        if (!data.roomId) {
          setLookupState({ status: "error", message: "Invite is missing room details." });
          return;
        }

        navigate(`/rooms/${data.roomId}?invite=${encodeURIComponent(inviteToken)}`, { replace: true });
      } catch {
        if (!controller.signal.aborted) {
          setLookupState({ status: "error", message: "Could not verify invite. Please try again." });
        }
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, [inviteToken, navigate]);

  if (lookupState.status === "loading") {
    return (
      <section className="panel-surface">
        <span className="eyebrow">Invite Link</span>
        <h2>Validating invite...</h2>
        <p className="section-copy">Checking room access and preparing your session.</p>
      </section>
    );
  }

  return (
    <section className="panel-surface">
      <span className="eyebrow">Invite Link</span>
      <h2>Invite unavailable</h2>
      <p className="section-copy">{lookupState.message}</p>
      <Link className="button button-secondary" to="/rooms">
        Go to room directory
      </Link>
    </section>
  );
}
