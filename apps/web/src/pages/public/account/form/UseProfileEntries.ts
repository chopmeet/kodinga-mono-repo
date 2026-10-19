import { customToast } from '@kodinga-mono-repo/ui';
import { parseApiError } from '@/utils/api/errors';
import type { EducationWriteData, ExperienceWriteData, PortfolioWriteData, SkillWriteData } from '@/utils/api/profile/profile.type';
import {
  useAddEducationMutation,
  useAddExperienceMutation,
  useAddPortfolioProjectMutation,
  useAddSkillMutation,
  useDeleteEducationMutation,
  useDeleteExperienceMutation,
  useDeletePortfolioProjectMutation,
  useDeleteSkillMutation,
  useGetMyProfileQuery,
  useUpdateEducationMutation,
  useUpdateExperienceMutation,
  useUpdatePortfolioProjectMutation,
} from '@/utils/api/user/user.api';

/** "2024-03" (input month) <-> "2024-03-01" (api date) */
export const toMonth = (date: string | null | undefined) => (date ? date.slice(0, 7) : '');
export const fromMonth = (month: string) => (month ? `${month}-01` : null);

const monthYear = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' });
/** "mars 2022 – aujourd’hui" */
export function period(start: string, end: string | null, current: boolean) {
  const from = monthYear.format(new Date(start));
  return `${from} – ${current || !end ? 'aujourd’hui' : monthYear.format(new Date(end))}`;
}

/**
 * Skills, experiences, educations and portfolio of the signed-in user (profiles/me/<entries>/).
 * Each action returns true when the api accepted it, so that a modal closes only then.
 */
function UseProfileEntries() {
  const profile = useGetMyProfileQuery();
  const [addSkill, { isLoading: isAddingSkill }] = useAddSkillMutation();
  const [deleteSkill] = useDeleteSkillMutation();
  const [addExperience, { isLoading: a1 }] = useAddExperienceMutation();
  const [updateExperience, { isLoading: u1 }] = useUpdateExperienceMutation();
  const [deleteExperience] = useDeleteExperienceMutation();
  const [addEducation, { isLoading: a2 }] = useAddEducationMutation();
  const [updateEducation, { isLoading: u2 }] = useUpdateEducationMutation();
  const [deleteEducation] = useDeleteEducationMutation();
  const [addProject, { isLoading: a3 }] = useAddPortfolioProjectMutation();
  const [updateProject, { isLoading: u3 }] = useUpdatePortfolioProjectMutation();
  const [deleteProject] = useDeletePortfolioProjectMutation();

  const run = async (action: Promise<unknown>, message: string) => {
    try {
      await action;
      customToast.success({ message });
      return true;
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
      return false;
    }
  };

  return {
    profile: profile.data,
    isLoading: profile.isLoading,
    loadError: profile.error ? parseApiError(profile.error).message : null,
    isAddingSkill,
    isSaving: a1 || u1 || a2 || u2 || a3 || u3,
    addSkill: (data: SkillWriteData) => run(addSkill(data).unwrap(), 'Compétence ajoutée.'),
    deleteSkill: (id: string) => run(deleteSkill(id).unwrap(), 'Compétence retirée.'),
    saveExperience: (id: string | null, data: ExperienceWriteData) =>
      run(id ? updateExperience({ id, ...data }).unwrap() : addExperience(data).unwrap(), id ? 'Expérience mise à jour.' : 'Expérience ajoutée.'),
    deleteExperience: (id: string) => run(deleteExperience(id).unwrap(), 'Expérience supprimée.'),
    saveEducation: (id: string | null, data: EducationWriteData) =>
      run(id ? updateEducation({ id, ...data }).unwrap() : addEducation(data).unwrap(), id ? 'Formation mise à jour.' : 'Formation ajoutée.'),
    deleteEducation: (id: string) => run(deleteEducation(id).unwrap(), 'Formation supprimée.'),
    saveProject: (id: string | null, data: PortfolioWriteData) =>
      run(id ? updateProject({ id, ...data }).unwrap() : addProject(data).unwrap(), id ? 'Projet mis à jour.' : 'Projet ajouté au portfolio.'),
    deleteProject: (id: string) => run(deleteProject(id).unwrap(), 'Projet retiré du portfolio.'),
  };
}

export type ProfileEntries = ReturnType<typeof UseProfileEntries>;

export default UseProfileEntries;
