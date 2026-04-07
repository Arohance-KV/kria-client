"use client";
import React from "react";
import {
    Mail,
    Phone,
    MapPin,
    Facebook,
    Instagram,
    Twitter,
    Dribbble,
    Globe,
} from "lucide-react";
import { FooterBackgroundGradient } from "@/components/ui/hover-footer";
import { TextHoverEffect } from "@/components/ui/hover-footer";

function HoverFooter() {
    // Footer link data
    const footerLinks = [
        {
            title: "About Us",
            links: [
                { label: "Our Story", href: "#" },
                { label: "Tournaments", href: "#" },
                { label: "Auction Platform", href: "#" },
                { label: "Contact", href: "#" },
            ],
        },
        {
            title: "Resources",
            links: [
                { label: "FAQs", href: "#" },
                { label: "Support", href: "#" },
                {
                    label: "Live Demo",
                    href: "#",
                    pulse: true,
                },
            ],
        },
    ];

    // Contact info data
    const contactInfo = [
        {
            icon: <Mail size={18} className="text-primary" />,
            text: "support@kriasports.com",
            href: "mailto:support@kriasports.com",
        },
        {
            icon: <Phone size={18} className="text-primary" />,
            text: "+91 86373 73116",
            href: "tel:+918637373116",
        },
        {
            icon: <MapPin size={18} className="text-primary" />,
            text: "Mumbai, India",
        },
    ];

    // Social media icons
    const socialLinks = [
        { icon: <Facebook size={20} />, label: "Facebook", href: "#" },
        { icon: <Instagram size={20} />, label: "Instagram", href: "#" },
        { icon: <Twitter size={20} />, label: "Twitter", href: "#" },
        { icon: <Dribbble size={20} />, label: "Dribbble", href: "#" },
        { icon: <Globe size={20} />, label: "Globe", href: "#" },
    ];

    return (
        <footer className="bg-[#0F0F11]/10 relative h-fit rounded-2xl md:rounded-3xl overflow-hidden m-4 md:m-8 border border-white/5 font-montserrat">
            <div className="max-w-7xl mx-auto px-5 py-10 md:p-14 z-40 relative">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-8 lg:gap-16 pb-10 md:pb-12">
                    {/* Brand section */}
                    <div className="flex flex-col space-y-4">
                        <div className="flex items-center space-x-2">
                            <span className="text-primary text-3xl font-oswald font-extrabold uppercase tracking-tighter">
                                KRIA
                            </span>
                            <span className="text-white text-3xl font-oswald font-bold uppercase tracking-tighter">Sports</span>
                        </div>
                        <p className="text-sm leading-relaxed text-gray-400">
                            Elevating local sports with professional auction and management tools.
                        </p>
                    </div>

                    {/* Footer link sections */}
                    {footerLinks.map((section) => (
                        <div key={section.title}>
                            <h4 className="text-white text-lg font-oswald font-semibold mb-6 uppercase tracking-wide">
                                {section.title}
                            </h4>
                            <ul className="space-y-3">
                                {section.links.map((link) => (
                                    <li key={link.label} className="relative">
                                        <a
                                            href={link.href}
                                            className="hover:text-primary transition-colors text-gray-400 text-sm"
                                        >
                                            {link.label}
                                        </a>
                                        {link.pulse && (
                                            <span className="absolute top-0 right-[-10px] w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    {/* Contact section */}
                    <div>
                        <h4 className="text-white text-lg font-oswald font-semibold mb-6 uppercase tracking-wide">
                            Contact Us
                        </h4>
                        <ul className="space-y-4">
                            {contactInfo.map((item, i) => (
                                <li key={i} className="flex items-center space-x-3">
                                    {item.icon}
                                    {item.href ? (
                                        <a
                                            href={item.href}
                                            className="hover:text-primary transition-colors text-gray-400 text-sm"
                                        >
                                            {item.text}
                                        </a>
                                    ) : (
                                        <span className="hover:text-primary transition-colors text-gray-400 text-sm">
                                            {item.text}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <hr className="border-t border-gray-800 my-8" />

                {/* Footer bottom */}
                <div className="flex flex-col md:flex-row justify-between items-center text-sm space-y-4 md:space-y-0">
                    {/* Social icons */}
                    <div className="flex space-x-2 text-gray-500">
                        {socialLinks.map(({ icon, label, href }) => (
                            <a
                                key={label}
                                href={href}
                                aria-label={label}
                                className="hover:text-primary active:text-primary transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                            >
                                {icon}
                            </a>
                        ))}
                    </div>

                    {/* Copyright */}
                    <p className="text-center md:text-left text-gray-500 font-oswald tracking-wide">
                        &copy; {new Date().getFullYear()} Kria Sports. All rights reserved.
                    </p>
                </div>
            </div>

            {/* Text hover effect */}
            <div className="lg:flex hidden h-[30rem] -mt-52 -mb-36">
                <TextHoverEffect text="KRIA" className="z-50" />
            </div>

            <FooterBackgroundGradient />
        </footer>
    );
}

export default HoverFooter;
