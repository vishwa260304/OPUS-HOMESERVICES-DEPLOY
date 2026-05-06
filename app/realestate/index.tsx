import { Redirect } from 'expo-router';

export default function RealEstateIndex() {
  return <Redirect href="/realestate/[id]" />;
}
