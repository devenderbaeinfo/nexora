import { useNavigate } from "react-router-dom";
import NewProjectForm from "./NewProjectForm";
import { pageStyles as s } from "../styles/pageKit";

export default function CreateProject() {
  const navigate = useNavigate();

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Create Project</h1>
          <p style={s.subtitle}>Set up a new project with its customer, manager, and budget.</p>
        </div>
      </header>
      <div style={{ ...s.card, maxWidth: 480 }}>
        <NewProjectForm onDone={() => navigate("/projects")} />
      </div>
    </div>
  );
}
