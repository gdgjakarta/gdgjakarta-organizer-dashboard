export default function MemberDashboardPage() {
  return (
    <div className="flex h-full flex-col p-4 md:p-6 lg:p-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Member Dashboard</h1>
        <p className="text-muted-foreground">Welcome to the GDG Jakarta community dashboard.</p>
      </div>
      <div className="mt-8">
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="font-semibold leading-none tracking-tight">Upcoming Events</h3>
            <p className="text-sm text-muted-foreground">Check out the events happening soon.</p>
          </div>
          <div className="p-6 pt-0">
            {/* Placeholder for events */}
            <p className="text-sm text-muted-foreground">No upcoming events found.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
