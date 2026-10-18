# JanaMen first-visit film

Owner request: ten seconds of creative, dynamic video before the login page, made with Cinetic and Earshot. A second Astra medium worker owns the film artifact. The coordinator owns application integration.

## Acceptance

- Actual encoded MP4, ten seconds, with an inspected poster and reproducible source.
- Cinetic provides the film workflow. Earshot provides sound design. Record their source revisions and asset licenses with the delivered film.
- Start muted for browser autoplay. Sound turns on only through the visible control.
- Show once per tab session before login. Do not replay on logout or route changes.
- Skip immediately by button or Escape. With reduced motion, go directly to login.
- Failed playback must not prevent login. A bounded fifteen-second watchdog includes startup/network time.
- Keep video proportions on desktop and mobile. Controls stay visible at 320px.
- Verify playback, sound control, completion, skip, reload, reduced motion and failed asset loading in the browser.

## Design decisions

The visual language follows the supplied graphite, paper and solar reference. The film is a brand opening, not evidence of an implemented business capability. Avoid promises about automatic HR decisions, real integrations or legal verification.

Emil's frequency rule limits the film to a first visit. Boundary Discipline keeps media/storage failure handling at the browser boundary. Existing native video and button elements avoid a new player dependency.

The film is not yet delivered. The local player source is prepared but is not yet wired into the application.

## Delivery 16:39 Almaty

The 10-second 1920×1080 H.264 film is connected before unauthenticated login. It plays muted, once per browser session. Skip, Escape, playback failure and reduced motion open login. Browser verification proved duration 10, playback active, muted, skip and reload without replay. Audio listening has not been independently accepted. Sources and license details are retained in the film artifact bundle.
