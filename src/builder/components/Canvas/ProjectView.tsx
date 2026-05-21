import { useBuilder } from '../../state/BuilderContext';
import { TitleBar } from '../TitleBar/TitleBar';

export function ProjectView() {
  const { doc, updateProject } = useBuilder();

  return (
    <TitleBar
      crumbs="Project"
      level="project"
      name={doc.name}
      onNameChange={name => updateProject({ name })}
      spec={doc.spec}
      onSpecChange={spec => updateProject({ spec })}
    />
  );
}
