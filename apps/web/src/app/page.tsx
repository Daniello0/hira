import { redirect } from 'next/navigation';

/** The product opens on the chat. */
export default function HomePage() {
  redirect('/chat');
}
