import type { ReactNode } from "react";
import { loginPageConfig } from "../../config/loginPageConfig";
import { ShieldIcon } from "./DashboardPreview";

// A code-based laptop mockup (bezel + camera notch + base/keyboard deck), not an image —
// whatever is passed as children renders "on screen" and stays fully editable. The security
// badge is rendered here, outside the screen's own clipped corners, so it floats freely over
// the hinge instead of being cut off by the screen content's rounded-corner overflow:hidden.
export default function LaptopFrame({ children }: { children: ReactNode }) {
  return (
    <div className="bae-laptop">
      <div className="bae-laptop-screen">
        <span className="bae-laptop-camera" aria-hidden="true" />
        <div className="bae-laptop-screen-content">{children}</div>
      </div>
      <div className="bae-laptop-base">
        <span className="bae-laptop-notch" aria-hidden="true" />
      </div>

      <div className="bae-security-badge">
        <ShieldIcon size={12} />
        {loginPageConfig.dashboardPreview.securityBadgeLabel}
      </div>
    </div>
  );
}
