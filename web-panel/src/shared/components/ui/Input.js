import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './Input.css';

/**
 * Modern Input Component
 * With label, error states, icons
 */
export const Input = ({
    label,
    type = 'text',
    placeholder,
    value,
    onChange,
    error,
    disabled = false,
    required = false,
    icon,
    className = '',
    ...props
}) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <div className={`input-wrapper ${className}`}>
            {label && (
                <label className="input-label">
                    {label}
                    {required && <span className="input-required">*</span>}
                </label>
            )}

            <div className={`input-container ${isFocused ? 'input-focused' : ''} ${error ? 'input-error' : ''}`}>
                {icon && <span className="input-icon">{icon}</span>}
                <input
                    type={type}
                    className="input-field"
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    disabled={disabled}
                    {...props}
                />
            </div>

            {error && <span className="input-error-text">{error}</span>}
        </div>
    );
};

Input.propTypes = {
    label: PropTypes.string,
    type: PropTypes.string,
    placeholder: PropTypes.string,
    value: PropTypes.string,
    onChange: PropTypes.func,
    error: PropTypes.string,
    disabled: PropTypes.bool,
    required: PropTypes.bool,
    icon: PropTypes.node,
    className: PropTypes.string,
};
