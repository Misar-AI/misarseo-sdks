/**
 * seo_list_projects — list the caller's MisarSEO projects.
 * This is the entry point: every other tool needs a projectId from here.
 */
export function registerListProjectsTool(server, client) {
    server.tool("seo_list_projects", "List the MisarSEO projects available to you. Call this first to obtain a projectId for the other tools. Free — charges no credits.", {}, async () => {
        const result = await client.get("/projects");
        return {
            content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
            ],
        };
    });
}
//# sourceMappingURL=listProjects.js.map