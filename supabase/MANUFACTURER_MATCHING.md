# Manufacturer matching

Super Admin → Production review → Assignment ranks manufacturers who completed onboarding and are not paused. The assignment action checks the saved requirements again and uses the existing quotation request workflow. Choosing a different eligible factory can record an optional reason in the order's assignment history.

Eligibility uses the saved garment, confirmed fabric and construction, methods and their minimums, bulk MOQ, shipping destinations, availability to take orders, and recorded order ceilings. Missing onboarding evidence is identified for confirmation. A supported relative customer timeline is checked separately from the quotation deadline. Approved calendar closures, known lead times, existing deadlines and observed on-time quotes influence delivery suitability.

Production load includes released or paid production still in progress and excludes completed, rejected, cancelled, shipped and QC-approved work. Quote requests are shown separately. Units come from the selected option or an unambiguous sample. Dates come from the production timeline, the latest production update, or the recorded quote lead time. Reported available capacity takes precedence. Estimated capacity is monthly capacity adjusted for working days and closures, less known active units. An estimate requires a recorded work schedule and known quantities and dates for all active work. These are workload estimates rather than factory commitments.

Settings live in the existing Super Admin platform settings record named manufacturer_matching.

- windowDays (60, bounded to 7–365) is the rolling opportunity and payment window.
- similarityPoints (5, bounded to 0–25) is the permitted suitability gap from the best candidate. Zero limits fairness to exact suitability ties.
- workloadWeight (1) applies per active order and competing deadline, plus the share of recorded monthly capacity already committed. Without a capacity figure, each doubling of known units adds roughly one tenth of an active order. A known capacity shortfall adds one workload point.
- paidWeight (1), opportunityWeight (0.15) and outstandingWeight (0.25) apply per recent verified paid order, distinct recent order offered for quotation, and open quotation request. Declines and expired requests carry no additional penalty. An unpaid opportunity never counts as a paid order.
- Suitability starts at 100 points. A closed quotation window costs 30 points, a production closure day 2 points (up to 20), and an active deadline during closure 4 points (up to 12). A missing lead time costs 8 points, while a recorded lead time costs one point per three days (up to 20). Observed quote lateness costs up to 20 points and each onboarding uncertainty costs 2 points. After fairness and suitability, fewer recent assignments and a longer time since assignment break ties. The final tie is rotated deterministically by order and factory.

Assignment history reuses the order routing ledger. The existing assignment event is the quotation request and records the deadline. Expiry is derived from the saved deadline, subsequent responses and reroutes. Payment and production release are separate milestones. Historical deadlines that were never stored cannot be reconstructed after a reroute.
