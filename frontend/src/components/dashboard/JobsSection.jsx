import JobCard from './JobCard'

export default function JobsSection({
  jobs,
  expandedJob,
  onToggleJob,
  showSimulation,
  onToggleSimulation,
  onFixStrategy,
  token,
}) {
  return (
    <section className="workspace-jobs" id="workspace-jobs">
      <div className="workspace-section-head">
        <div>
          <span className="workspace-kicker">Recent Activity</span>
          <h2>Your Algorithms</h2>
        </div>
        <span className="workspace-count-badge">{jobs.length} / 5</span>
      </div>

      {!jobs.length ? (
        <div className="workspace-jobs-empty">
          <h3>No algorithms yet</h3>
          <p>Your generated strategies, validation failures, and compile states will appear here.</p>
        </div>
      ) : (
        <div className="jobs-list">
          {jobs.map((job) => (
            <JobCard
              key={job.job_id}
              job={job}
              isExpanded={expandedJob === job.job_id}
              onToggle={() => onToggleJob(job.job_id)}
              onFixStrategy={onFixStrategy}
              showSimulation={!!showSimulation[job.job_id]}
              onToggleSimulation={() => onToggleSimulation(job.job_id)}
              token={token}
            />
          ))}
        </div>
      )}
    </section>
  )
}

