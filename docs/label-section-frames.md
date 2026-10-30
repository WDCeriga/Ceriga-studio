# Label colour sections and text frames

Colour sections and text frames can reach the physical label edge with **Full label width · edge to edge**. This uses absolute millimetre bounds instead of the inset content layout. The label outline still clips artwork.

Select a text block or manual text section and choose **Text belongs to** to attach it to a colour section. Text padding is measured in millimetres. Moving or resizing the colour section recomputes its linked text bounds. **+ Text in this section** creates linked text directly; **+ Colour behind text** attaches an existing arranged block to a new background. Deleting a colour section detaches its text at its current bounds.

Label border controls are named Stitching / Show stitching. This is a terminology change; the existing line appearance is retained. Label section fills opt out of the generic shape renderer’s default stroke inset so their visible edges match their selection bounds.

Native shared-editor migration includes linked text in the colour frame's artwork membership. New optional fields are retained by save/load; legacy objects without those fields retain their layout.

Verification: `node scripts/verify-label-section-frames.mjs`, existing surface contracts, and the frozen SVG regression suite run before production builds.
