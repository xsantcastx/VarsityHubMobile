# VarsityHubMobile Developer Handoff Document

## 1. UI/UX Standards
- All profile pages must use the locked layout (cover image, avatar, name, edit button, tabs, etc.). No deviations.
- Manage Season, Discover, and all major screens must follow the same modern, clean, and consistent design.
- Navigation: Back buttons, tab bars, and modals must work everywhere. No dead-ends.

## 2. Functionality
- All actions (add event, create team, view team, view league, etc.) must be fully functional and tested.
- Authentication: Handle login, logout, and token expiration gracefully. Show clear errors and guide users to re-authenticate.
- Error Handling: All API/network errors must show user-friendly messages and offer retry options.

## 3. Performance & Quality
- Optimize images and assets. Remove unused dependencies and code.
- Run all lint, unit, and E2E tests. Manually test on iOS and Android, including edge cases (no data, slow network, etc.).
- Accessibility: Ensure text is readable, buttons are large enough, and navigation works with screen readers.

## 4. Build & Deployment
- Use Node 20.11.1 (pinned in eas.json). Use `npm ci --prefer-offline` for installs.
- Use the new CI build scripts in package.json for EAS builds. Monitor build logs for errors or slow steps.
- Enable EAS cache and avoid unnecessary npm audit/install steps in build scripts.

## 5. Security & Secrets
- Never commit secrets or API keys. Use environment variables and secure storage for sensitive data.

## 6. Documentation
- Update README and in-app help for any new features or changes.
- Document any custom scripts, build steps, or environment requirements.

## 7. Handoff Checklist
- [ ] All screens match locked UI/UX standards
- [ ] All navigation flows work (no dead-ends)
- [ ] All actions and features are functional
- [ ] All errors are user-friendly
- [ ] All tests pass (lint, unit, E2E)
- [ ] App is accessible
- [ ] Build and deploy scripts work with Node 20.11.1
- [ ] No secrets in code
- [ ] Documentation is up to date

---

**Contact:**
For any questions or clarifications, contact the project owner or lead developer.
