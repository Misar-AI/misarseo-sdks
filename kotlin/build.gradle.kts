plugins {
    kotlin("jvm") version "2.2.20"
    `java-library`
    id("com.vanniktech.maven.publish") version "0.37.0"
}

group = "io.misar"
version = "1.0.0"

repositories {
    mavenCentral()
}

dependencies {
    api("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.2")
    api("com.fasterxml.jackson.core:jackson-databind:2.18.9")
    testImplementation(kotlin("test"))
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

kotlin {
    jvmToolchain(17)
}

tasks.test {
    useJUnitPlatform()
}

mavenPublishing {
    publishToMavenCentral(automaticRelease = true)
    signAllPublications()
    coordinates("io.misar", "misarseo-kotlin", version.toString())

    pom {
        name.set("MisarSEO Kotlin SDK")
        description.set(
            "MisarSEO's API from Kotlin: keyword research, site audits, rank tracking, backlinks, " +
                "AI search visibility, Search Console, GA4 and Business Profile — coroutines, retries, " +
                "typed plan-limit exceptions with the upgrade offer, and a Flow for SSE crawl progress."
        )
        url.set("https://seo.misar.io")
        inceptionYear.set("2026")
        organization {
            name.set("Misar.AI")
            url.set("https://misar.io")
        }
        licenses {
            license {
                name.set("MIT License")
                url.set("https://opensource.org/licenses/MIT")
                distribution.set("repo")
            }
        }
        developers {
            developer {
                id.set("misar-ai")
                name.set("Misar.AI")
                email.set("noreply@misar.io")
                organization.set("Misar.AI")
                organizationUrl.set("https://misar.io")
            }
        }
        scm {
            connection.set("scm:git:git://github.com/Misar-AI/misarseo-sdks.git")
            developerConnection.set("scm:git:ssh://github.com/Misar-AI/misarseo-sdks.git")
            url.set("https://github.com/Misar-AI/misarseo-sdks/tree/main/kotlin")
        }
        issueManagement {
            system.set("GitHub Issues")
            url.set("https://github.com/Misar-AI/misarseo-sdks/issues")
        }
    }
}
