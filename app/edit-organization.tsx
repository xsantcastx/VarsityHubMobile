import { Redirect } from 'expo-router';

export default function EditOrganizationRedirect() {
  return <Redirect href={'/organization' as any} />;
}
