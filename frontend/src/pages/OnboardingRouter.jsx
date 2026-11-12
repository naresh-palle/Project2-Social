import { useAuth } from "@/lib/auth";
import Onboarding from "@/pages/Onboarding";
import ProfileCompletion from "@/pages/ProfileCompletion";

/**
 * Agents with pending/declined approval keep the legacy approval screens.
 * Everyone else uses the new 5-step profile completion wizard.
 */
export default function OnboardingRouter() {
  const { user } = useAuth();
  if (
    user?.role === "agent" &&
    (user.onboarding_status === "pending_approval" ||
      user.onboarding_status === "declined" ||
      (user.onboarding_completed === true && user.agent_approved === false) ||
      (user.profile_completion_status === "COMPLETED" && user.agent_approved === false))
  ) {
    return <Onboarding />;
  }
  return <ProfileCompletion />;
}
