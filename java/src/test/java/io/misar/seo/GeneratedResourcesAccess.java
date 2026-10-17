package io.misar.seo;

import io.misar.seo.generated.GeneratedResources;

/** Reads a resource field by its manifest name, for the table-driven test. */
final class GeneratedResourcesAccess {
    private GeneratedResourcesAccess() {}

    static Object field(GeneratedResources client, String resource) throws ReflectiveOperationException {
        return GeneratedResources.class.getField(resource).get(client);
    }
}
