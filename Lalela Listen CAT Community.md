## Lalela Listen: CAT (Community Assistance Tax) Integration with Charity Workflow

### Overview

Lalela Listen is a community-driven platform where members trade, support each other, and drive local change. Central to this is CAT (Community Action Token)—a default, embedded mechanism that gives members a 15% opportunity to earn from external sales, building a cycle of prosperity within the community. Alongside CAT, we maintain a flexible charity system where members suggest causes, and the admin selects the featured charity.

### Charity Suggestion Workflow

1. Members can propose charities using a dedicated “Charity Suggestion” dialogue (accessible via the app).
2. Each suggestion is reviewed and compiled for admin evaluation.
3. The admin panel allows the admin to view all suggested charities.
4. The admin selects one charity as the “featured charity” for a specific period. Once chosen, the featured charity is highlighted, and all CAT-based contributions during that period will be directed to it.

### CAT Default Structure

* **Default Mode**: All listings begin in “local mode.” In this mode, you buy or sell items within the community at a fair, agreed price.
* **Public Mode**: If a member opts to list an item publicly (outside the community), a 15% CAT margin is applied. By default, this margin is earnings for the seller. They may choose at any time to donate these earnings back into the community charity, but it is not mandatory. This design ensures every member has a potential income stream while preserving the charity option as a flexible contribution.

### Charity Integration with CAT

* The CAT system is always active. By default, members keep their 15% earnings when selling publicly. However, when the community admin activates a charity cycle, these CAT margins become pooled, and all earnings go to the featured charity. This creates a dual pathway: individual earnings by default, but a collective, charitable impact when the community decides.

### Developer Instructions

1. Integrate the existing charity suggestion dialog: Allow members to suggest charities, and store these for admin review.
2. Admin Panel: Ensure admins can view all suggested charities and select one as the “featured charity” for the community.
3. CAT Default Logic: Embed CAT into every listing by default. When in local mode, no fee applies. When in public mode, apply the 15% CAT fee automatically.
4. Charity Toggle: Add a switch in the admin panel that activates a “charity cycle.” During this cycle, all CAT earnings automatically pool into the selected charity, creating a community-wide impact.
5. User Communication: Design clear notifications so members understand CAT: they earn by default, but can also give back.

### Appendix A: Charity Hub – Community Benefit Tracker

On the admin dashboard, within the Charity Hub, a dynamic tracker will display the total amount the community has collectively benefited through CAT. Each time a public sale is completed, the CAT margin is recorded and added to this tracker. This provides transparency on how the community collectively supports itself, mirroring the charity contributions and giving members a sense of pride in their shared success.

---

### Appendix B: Listing Card – CAT Impact Display

On the home page, every listing card will be updated to reflect CAT impact. Alongside the price, each card will explicitly state how much of the transaction is contributing to CAT. If a charity cycle is active, the card will also display the name of the featured charity and a statement that proceeds are being pooled for that cause. This structure ensures that every buyer sees both the price and the positive impact they’re making, reinforcing the value of each transaction.


### Appendix B: CAT as a Default Community Benefit Cycle

Upon creating a new community, a charity called CAT is automatically generated and remains fixed—it cannot be renamed. This ensures every community has a baseline charity structure from day one. When a member posts a listing, they set their local price as normal. If they choose to sell publicly, CAT automatically applies a 15% margin. This model empowers every member: you can make a direct local sale, but you also have the potential to scale by selling externally, earning from that spread. Thus, CAT always acts as a silent engine of community benefit—either kept as earnings by individuals or pooled back if the community decides. In this way, every member understands they have both a personal and collective stake in the value they create.


