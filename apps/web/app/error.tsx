'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="server-page"><h1>We’ll be right back.</h1><p>The store is temporarily unavailable. Please try again in a moment.</p><button className="primary" onClick={reset}>Try again</button></main>}
