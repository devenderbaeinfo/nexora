import { plans } from "../../data/adminMockData";
import PlanCard from "../../components/admin/PlanCard";
import { adminStyles as s } from "../../components/admin/adminStyles";

export default function AdminPlans() {
  return (
    <div>
      <header style={s.header}>
        <h1 style={s.title}>Plans</h1>
        <p style={s.subtitle}>The subscription tiers clients choose from — pricing, user limits, and included modules.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {plans.map((plan) => (
          <PlanCard plan={plan} featured={plan.name === "Professional"} key={plan.name} />
        ))}
      </div>
    </div>
  );
}
