import { redirect } from 'next/navigation';

export default function InventoryPage() {
  redirect('/master/customers?tab=inventory');
}
